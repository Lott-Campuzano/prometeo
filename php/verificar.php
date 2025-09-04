<?php
session_start();
?>
<script src="https://cdn.tailwindcss.com"></script>
<div class="min-h-screen flex items-center justify-center bg-gray-100">
  <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-md space-y-6">
    <?php if (isset($_SESSION['verificar'])): ?>
      <p class="text-red-500 text-center"><?php echo $_SESSION['verificar']; ?></p>
      <?php unset($_SESSION['verificar']); ?>
    <?php endif; ?>

    <?php if (isset($_SESSION['msg'])): ?>
      <p class="text-green-500 text-center"><?php echo $_SESSION['msg']; ?></p>
      <?php unset($_SESSION['msg']); ?>
    <?php endif; ?>

    <h1 class="text-2xl font-bold text-gray-800 text-center">Verificar Token</h1>
    <form method="post" action="/php/process.php" class="space-y-4">
      <div>
        <label for="usuario" class="block text-sm font-medium text-gray-700">Usuario</label>
        <input type="text" id="usuario" name="usuario" required
          class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
      </div>
      <div>
        <label for="token" class="block text-sm font-medium text-gray-700">Token</label>
        <input type="text" id="token" name="token" required
          class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
      </div>
      <input type="hidden" name="verificar" value="1">
      <button type="submit"
        class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition">Verificar Token</button>
    </form>
  </div>
</div>