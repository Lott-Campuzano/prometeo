<?php session_start(); ?>
<script src="https://cdn.tailwindcss.com"></script>
<div class="min-h-screen flex items-center justify-center bg-gray-100">
  <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-md space-y-6">
    <h1 class="text-2xl font-bold text-gray-800 text-center">Crear Cuenta</h1>
    <form method="post" action="/php/sign.php" class="space-y-4">
      <div>
        <label for="usuario" class="block text-sm font-medium text-gray-700">Usuario</label>
        <input type="text" id="usuario" name="usuario" required
          class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
      </div>
      <div>
        <label for="contraseña" class="block text-sm font-medium text-gray-700">Contraseña</label>
        <input type="password" id="contraseña" name="contraseña" required
          class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
      </div>
      <div>
        <label for="correo" class="block text-sm font-medium text-gray-700">Correo</label>
        <input type="email" id="correo" name="correo" required
          class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
      </div>
      <input type="hidden" name="registrar" value="1">
      <button type="submit"
        class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition">Crear cuenta</button>
    </form>
    <div class="text-center">
      <p class="text-sm text-gray-600">¿Ya tienes una cuenta?</p>
      <form action="login.php">
        <button type="submit"
          class="mt-2 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition">Iniciar sesión</button>
      </form>
    </div>
  </div>
</div>