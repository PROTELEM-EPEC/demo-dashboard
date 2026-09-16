/* Visor de la galeria publicada.
 *
 * Las 14 piezas viajan cifradas con AES-256-GCM dentro de assets/datos.js. La
 * contrasena deriva la clave con PBKDF2 y todo el descifrado pasa en el
 * navegador: el servidor nunca ve la clave y en GitHub Pages no hay un solo
 * byte legible del contenido.
 *
 * La clave vive unicamente en memoria. No se guarda en localStorage ni en una
 * cookie a proposito: si guardaramos la clave, cualquiera con acceso al equipo
 * la levanta, y el candado dejaria de valer para lo unico que sirve. El precio
 * es que recargar la pagina vuelve a pedir la contrasena.
 */
(function () {
  'use strict';

  var PAQUETE = window.PAQUETE;

  var NIVELES = [0.5, 0.65, 0.8, 1, 1.25, 1.5];
  var ZOOM_MIN = 0.35;
  var MARGEN = 8;

  var candado = document.getElementById('candado');
  var formulario = document.getElementById('formulario');
  var entradaClave = document.getElementById('clave');
  var botonEntrar = document.getElementById('entrar');
  var estado = document.getElementById('estado');

  var nav = document.getElementById('nav');
  var marco = document.getElementById('marco');
  var lienzo = document.getElementById('lienzo');
  var elTitulo = document.getElementById('titulo');
  var elNota = document.getElementById('descripcion');
  var elContador = document.getElementById('contador');
  var elNivel = document.getElementById('nivel');
  var btnAnterior = document.getElementById('anterior');
  var btnSiguiente = document.getElementById('siguiente');
  var btnCerrar = document.getElementById('cerrar');

  var clave = null;          // CryptoKey, solo en memoria
  var descifradas = {};      // id -> html ya descifrado
  var PIEZAS = [];
  var enlaces = {};
  var indice = -1;
  var zoom = 1;
  var zoomAuto = true;

  // ------------------------------------------------------------- utilidades

  function deBase64(texto) {
    var binario = atob(texto);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  function avisar(texto, esError) {
    estado.textContent = texto;
    if (esError) estado.setAttribute('data-error', '');
    else estado.removeAttribute('data-error');
  }

  // --------------------------------------------------------------- descifrado

  async function derivarClave(contrasena) {
    var kdf = PAQUETE.kdf;
    var material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: deBase64(kdf.sal),
        iterations: kdf.iteraciones,
        hash: kdf.hash
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function descifrar(blob) {
    var plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deBase64(blob.iv) }, clave, deBase64(blob.datos));
    return new TextDecoder().decode(plano);
  }

  // ------------------------------------------------------------ desbloqueo

  async function desbloquear(e) {
    e.preventDefault();
    if (!window.crypto || !crypto.subtle) {
      avisar('Este navegador no expone WebCrypto. Hace falta abrir el sitio ' +
             'por https (o localmente por file://), no por http.', true);
      return;
    }

    botonEntrar.disabled = true;
    entradaClave.disabled = true;
    avisar('Descifrando…');

    try {
      clave = await derivarClave(entradaClave.value);
      // Alcanza con que el centinela descifre: AES-GCM valida un tag de
      // autenticacion y tira excepcion si la clave esta mal. No comparamos su
      // contenido para no dejar el texto plano escrito aca.
      await descifrar(PAQUETE.centinela);
    } catch (err) {
      clave = null;
      botonEntrar.disabled = false;
      entradaClave.disabled = false;
      entradaClave.value = '';
      entradaClave.focus();
      avisar('Contraseña incorrecta.', true);
      return;
    }

    entradaClave.value = '';
    document.body.classList.remove('bloqueado');
    candado.setAttribute('hidden', '');
    arrancarGaleria();
  }

  function bloquear() {
    clave = null;
    descifradas = {};
    // Recargar es la unica forma barata de garantizar que no queda contenido
    // descifrado colgado en el DOM ni en el iframe.
    location.reload();
  }

  // ------------------------------------------------------------------- nav

  function construirNav() {
    var grupoActual = null;
    var lista = null;

    PIEZAS.forEach(function (pieza) {
      if (pieza.grupo !== grupoActual) {
        grupoActual = pieza.grupo;
        var titulo = document.createElement('p');
        titulo.className = 'grupo';
        titulo.textContent = grupoActual;
        nav.appendChild(titulo);
        lista = document.createElement('ul');
        nav.appendChild(lista);
      }

      var enlace = document.createElement('a');
      enlace.href = '#' + pieza.id;
      enlace.appendChild(document.createTextNode(pieza.titulo));
      if (pieza.nota) {
        var nota = document.createElement('span');
        nota.className = 'nota';
        nota.textContent = pieza.nota;
        enlace.appendChild(nota);
      }

      var item = document.createElement('li');
      item.appendChild(enlace);
      lista.appendChild(item);
      enlaces[pieza.id] = enlace;
    });
  }

  // ------------------------------------------------------------------ zoom

  function calcularZoomAuto(pieza) {
    var disponible = lienzo.clientWidth - MARGEN;
    if (disponible <= 0) return 1;
    return Math.max(ZOOM_MIN, Math.min(1, disponible / pieza.ancho));
  }

  function aplicarZoom() {
    var pieza = PIEZAS[indice];
    if (!pieza) return;
    if (zoomAuto) zoom = calcularZoomAuto(pieza);

    marco.style.width = (lienzo.clientWidth / zoom) + 'px';
    marco.style.height = (lienzo.clientHeight / zoom) + 'px';
    marco.style.transform = 'scale(' + zoom + ')';
    elNivel.textContent = Math.round(zoom * 100) + '%';
  }

  function moverZoom(paso) {
    zoomAuto = false;
    var destino = null;
    if (paso > 0) {
      for (var i = 0; i < NIVELES.length; i++) {
        if (NIVELES[i] > zoom + 0.001) { destino = NIVELES[i]; break; }
      }
    } else {
      for (var j = NIVELES.length - 1; j >= 0; j--) {
        if (NIVELES[j] < zoom - 0.001) { destino = NIVELES[j]; break; }
      }
    }
    if (destino === null) return;
    zoom = destino;
    aplicarZoom();
  }

  // ----------------------------------------------------------- navegacion

  function porId(id) {
    for (var i = 0; i < PIEZAS.length; i++) {
      if (PIEZAS[i].id === id) return i;
    }
    return -1;
  }

  async function irA(i, moverFoco) {
    i = Math.max(0, Math.min(PIEZAS.length - 1, i));
    var pieza = PIEZAS[i];
    var cambio = i !== indice;
    indice = i;

    elTitulo.textContent = pieza.titulo;
    elNota.textContent = pieza.nota || '';
    elContador.textContent = (i + 1) + ' / ' + PIEZAS.length;
    marco.title = pieza.titulo;

    Object.keys(enlaces).forEach(function (id) {
      if (id === pieza.id) enlaces[id].setAttribute('aria-current', 'page');
      else enlaces[id].removeAttribute('aria-current');
    });

    btnAnterior.disabled = i === 0;
    btnSiguiente.disabled = i === PIEZAS.length - 1;

    zoomAuto = true;
    aplicarZoom();

    if (location.hash.slice(1) !== pieza.id) {
      history.replaceState(null, '', '#' + pieza.id);
    }

    if (cambio) {
      if (!descifradas[pieza.id]) {
        try {
          descifradas[pieza.id] = await descifrar(PAQUETE.piezas[pieza.id]);
        } catch (err) {
          elNota.textContent = 'No se pudo descifrar esta pieza.';
          return;
        }
      }
      // srcdoc y no un blob: asi el documento comparte origen con esta pagina y
      // las rutas relativas de las @font-face se resuelven contra docs/, que es
      // donde estan las tipografias.
      marco.srcdoc = descifradas[pieza.id];
    }

    if (moverFoco && enlaces[pieza.id]) enlaces[pieza.id].focus();
  }

  function desdeHash(moverFoco) {
    var i = porId(decodeURIComponent(location.hash.slice(1)));
    irA(i >= 0 ? i : 0, moverFoco);
  }

  // --------------------------------------------------------------- arranque

  async function arrancarGaleria() {
    // El indice (nombres, grupos y orden) tambien viaja cifrado.
    PIEZAS = JSON.parse(await descifrar(PAQUETE.indice));

    construirNav();

    btnAnterior.addEventListener('click', function () { irA(indice - 1, true); });
    btnSiguiente.addEventListener('click', function () { irA(indice + 1, true); });
    btnCerrar.addEventListener('click', bloquear);
    document.getElementById('alejar').addEventListener('click', function () { moverZoom(-1); });
    document.getElementById('acercar').addEventListener('click', function () { moverZoom(1); });
    document.getElementById('ajustar').addEventListener('click', function () {
      zoomAuto = true;
      aplicarZoom();
    });

    window.addEventListener('hashchange', function () { desdeHash(false); });
    window.addEventListener('resize', aplicarZoom);

    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var etiqueta = e.target && e.target.tagName;
      if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); irA(indice - 1, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); irA(indice + 1, true); }
    });

    desdeHash(false);
  }

  formulario.addEventListener('submit', desbloquear);
})();
