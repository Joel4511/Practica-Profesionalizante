(() => {
  const boton = document.querySelector("#tgt-chat-abrir");
  const chat = document.querySelector("#tgt-chat");
  const mensajes = chat.querySelector("[role=log]");
  const formulario = chat.querySelector("form");
  const entrada = formulario.elements.pregunta;
  const sugerencias = chat.querySelector(".tgt-chat-sugerencias");

  function agregarMensaje(autor, texto) {
    const mensaje = document.createElement("p");
    const titulo = document.createElement("strong");
    titulo.textContent = autor;
    mensaje.append(titulo, document.createTextNode(texto));
    if (autor === "Vos") mensaje.classList.add("tgt-chat-usuario");
    mensajes.append(mensaje);
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  function enviar(texto) {
    const pregunta = texto.trim();
    if (!pregunta || pregunta.length > entrada.maxLength) return;
    agregarMensaje("Vos", pregunta);
    agregarMensaje("Asistente", responderChat(pregunta));
  }

  agregarMensaje("Asistente", responderChat("/start"));
  for (const pregunta of preguntasChat) {
    const sugerencia = document.createElement("button");
    sugerencia.type = "button";
    sugerencia.textContent = pregunta;
    sugerencia.addEventListener("click", () => enviar(pregunta));
    sugerencias.append(sugerencia);
  }

  boton.addEventListener("click", () => chat.showModal());
  chat.querySelector(".tgt-chat-cerrar").addEventListener("click", () => chat.close());
  formulario.addEventListener("submit", event => {
    event.preventDefault();
    enviar(entrada.value);
    entrada.value = "";
    entrada.focus();
  });
})();
