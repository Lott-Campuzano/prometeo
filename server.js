// Archivo: server.js

// 1. Cargar las variables de entorno ANTES de hacer cualquier otra cosa
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// Habilitar CORS para que tu frontend pueda hacerle fetch a este servidor
app.use(cors());

// 2. Crear la ruta que consumirá tu frontend
app.get('/api/obtener-info', async (req, res) => {
    try {
        // Obtenemos la clave de forma segura sin que el frontend la vea
        const apiKey = process.env.MI_API_KEY;
        const apiUrl = process.env.API_URL;

        // 3. El servidor hace la petición a la API externa
        // (Usa el formato de headers que requiera la API que estás usando)
        const respuesta = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) {
            throw new Error('Error en la API externa');
        }

        const datos = await respuesta.json();

        // 4. Le enviamos los datos limpios a tu frontend
        res.json(datos);

    } catch (error) {
        console.error('Error del servidor:', error);
        res.status(500).json({ error: 'Hubo un problema al obtener los datos' });
    }
});

// Levantar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor intermediario corriendo en http://localhost:${PORT}`);
});