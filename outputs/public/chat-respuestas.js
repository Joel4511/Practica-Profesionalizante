const temasChat = [
  {
    pregunta: "¿Cómo pido un turno?",
    patron: /\b(turnos?|reserv\w*|horarios?|citas?)\b/,
    texto: "Ingresá al portal del cliente. En «Cargar turno y problema», elegí el equipo, la fecha y un horario disponible, describí la falla y presioná «Solicitar turno».",
  },
  {
    pregunta: "¿Dónde está mi reparación?",
    patron: /\b(reparacion(?:es)?|estado|seguimiento|orden|diagnostico)\b/,
    texto: "Si ya iniciaste sesión, buscá «Estado de mis reparaciones». Desde el inicio público también podés elegir «Estado de Reparación» y completar el número de orden y el teléfono usado en el taller. En Telegram escribí: estado NÚMERO_DE_ORDEN TELÉFONO.",
  },
  {
    pregunta: "¿Cómo contacto al taller?",
    patron: /\b(contacto|whatsapp|telefono|ubicacion|direccion|precio|presupuesto|costo)\b/,
    texto: "El taller publica el WhatsApp 2645358946 y la dirección Benavides y Salta 362 Sur. Podés consultar por presupuestos directamente con el taller.",
  },
  {
    patron: /\b(cuenta|registr\w*|sesion|ingresar|acceso|clave|contrasena)\b/,
    texto: "En la página de inicio elegí «Regístrate» para crear una cuenta o «Iniciar Sesión» si ya tenés una. Si no podés acceder, consultá al taller por WhatsApp al 2645358946.",
  },
  {
    patron: /\b(equipos?|pc|notebooks?|computadoras?|laptop)\b/,
    texto: "El formulario de turnos permite elegir notebook, PC de escritorio, All in One u otro equipo. Indicá la marca, el modelo y qué problema tiene.",
  },
];

const preguntasChat = temasChat.flatMap(tema => tema.pregunta ? [tema.pregunta] : []);
const saludoChat = "¡Hola! Soy el asistente de TGT. Te puedo ayudar a pedir un turno, seguir una reparación o contactar al taller.";

function responderChat(pregunta) {
  const texto = pregunta.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
  if (/^\/(start|help)(?:@\w+)?(?:\s|$)/.test(texto) || /^hola[! .]*$/.test(texto)) return saludoChat;
  return temasChat.find(tema => tema.patron.test(texto))?.texto
    ?? "Probá con una pregunta sobre turnos, reparaciones, cuentas o contacto con el taller.";
}

if (typeof module !== "undefined") module.exports = { preguntasChat, responderChat };
