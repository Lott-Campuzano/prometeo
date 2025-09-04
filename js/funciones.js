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
    chatForm.requestSubmit(); // Trigger form submit
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
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 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',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            store: true,
            messages: [
                { role: 'system', content: 'Eres un psicologo que sigue la corriente conductista dandole seguimiento a tu paciente' },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.2,
            max_tokens: 1500
          })
        });

        chatMessages.removeChild(typingIndicator);

        if (response.ok) {
          const data = await response.json();
          const botReply = data.choices[0].message.content;
          appendMessage(botReply, 'bot');
        } else {
          appendMessage('Error: No se pudo obtener una respuesta del modelo.', 'bot');
        }
      } catch (error) {
        chatMessages.removeChild(typingIndicator);
        appendMessage('Error: ' + error.message, 'bot');
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
  // Si usas localStorage para tokens o nombres de usuario, aquí podrías limpiar:
  // localStorage.removeItem('token');
  // localStorage.removeItem('username');

  // Redirige a la página de login o inicio
  window.location.href = 'login.php'; // Cambia esto si usas otra ruta
});


