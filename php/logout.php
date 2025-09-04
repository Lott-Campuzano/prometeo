<?php
session_start();
session_unset(); // Limpia todas las variables de sesión
session_destroy(); // Destruye la sesión
header('Location: ../interfaz/login.php'); // Redirige al inicio de sesión
exit;
?>