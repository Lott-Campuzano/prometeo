const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendButton = chatForm.querySelector('button');

// Mostrar botón solo si hay texto
userInput.addEventListener('input', () => {
  sendButton.style.display = userInput.value.trim() ? 'inline-block' : 'none';
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// Ocultarlo por defecto al cargar
sendButton.style.display = 'none';

function appendMessage(text, sender) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('d-flex', 'flex-column', sender === 'user' ? 'align-items-end' : 'align-items-start', 'mb-2');

  const label = document.createElement('small');
  label.classList.add('text-muted', 'mb-1');
  label.textContent = sender === 'user' ? 'Tú' : 'Silva';

  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  messageDiv.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(messageDiv);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  appendMessage(userMessage, 'user');
  userInput.value = '';

  const typingIndicator = document.createElement('div');
  typingIndicator.classList.add('message', 'bot');
  typingIndicator.textContent = 'Dame un momento...';
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // CAMBIO PRINCIPAL: Ahora le hacemos fetch a TU servidor intermediario
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Solo enviamos el mensaje, el backend se encarga de estructurarlo para OpenAI
      body: JSON.stringify({ message: userMessage })
    });

    chatMessages.removeChild(typingIndicator);

    if (response.ok) {
      const data = await response.json();
      // Leemos la respuesta tal como nos la devuelve OpenAI a través de nuestro backend
      const botReply = data.choices[0].message.content;
      appendMessage(botReply, 'bot');
    } else {
      appendMessage('Error: No se pudo obtener una respuesta del servidor.', 'bot');
    }
  } catch (error) {
    chatMessages.removeChild(typingIndicator);
    appendMessage('Error: ' + error.message, 'bot');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  window.location.href = 'login.php';
});