<?php
session_start();
$pdo = new PDO('mysql:host=localhost;dbname=mi_base', 'user', 'pass');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
ob_start();

$user = filter_input(INPUT_POST, 'usuario', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$mail = filter_input(INPUT_POST, 'correo', FILTER_VALIDATE_EMAIL);
$pass = $_POST['contraseña'];

if (!empty($user) && !empty($pass)) {
    try {
        // Revisamos que el usuario exista antes de registrarlo
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE usr = :username");
        $checkStmt->bindParam(':username', $user);
        $checkStmt->execute();
        $existe = $checkStmt->fetchColumn();

        if ($existe) {
            echo "<div class='bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative' role='alert'>
                    <strong class='font-bold'>Aviso:</strong>
                    <span class='block sm:inline'>Este usuario ya existe.</span>
                  </div>";
        } else {
            $hashedPassword = password_hash($pass, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("INSERT INTO usuarios (usr, email, pass) VALUES (:username, :mail, :password)");
            $stmt->bindParam(':username', $user);
            $stmt->bindParam(':mail', $mail);
            $stmt->bindParam(':password', $hashedPassword);

            if ($stmt->execute()) {
                echo "<div class='bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative' role='alert'>
                        <strong class='font-bold'>Éxito:</strong>
                        <span class='block sm:inline'>" . htmlspecialchars($user) . ", te has registrado con éxito.</span>
                      </div>";
            } else {
                echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
                        <strong class='font-bold'>Error:</strong>
                        <span class='block sm:inline'>Error al registrar el usuario.</span>
                      </div>";
            }
        }
    } catch (PDOException $e) {
        echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
                <strong class='font-bold'>Error:</strong>
                <span class='block sm:inline'>" . htmlspecialchars($e->getMessage()) . "</span>
              </div>";
    }
} else {
    echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
            <strong class='font-bold'>Error:</strong>
            <span class='block sm:inline'>Por favor, completa todos los campos requeridos.</span>
          </div>";
}
?>
  <script src="https://cdn.tailwindcss.com"></script>
