<?php
session_start();
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../vendor/autoload.php';

// Configuración de base de datos
$dsn = 'mysql:host=localhost;dbname=mi_base';
$db_user = 'user';
$db_pass = 'pass';

try {
    $pdo = new PDO($dsn, $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Error de conexión: " . $e->getMessage());
}

$ip = $_SERVER['REMOTE_ADDR'];

// ========================
// FUNCIONES AUXILIARES
// ========================

// Verifica si la IP está bloqueada
function is_ip_blocked($pdo, $ip) {
    $stmt = $pdo->prepare("SELECT * FROM ips_bloqueadas WHERE ip = :ip");
    $stmt->execute(['ip' => $ip]);
    $ip_data = $stmt->fetch(PDO::FETCH_ASSOC);
    $now = new DateTime();

    if ($ip_data && $ip_data['bloqueado_hasta'] && $now < new DateTime($ip_data['bloqueado_hasta'])) {
        $_SESSION['verificar'] = "Tu IP ha sido bloqueada hasta: " . $ip_data['bloqueado_hasta'];
        echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Error:</strong>
        <span class='block sm:inline'>Tu IP ha sido bloqueada hasta: " . htmlspecialchars($ip_data['bloqueado_hasta']) . ".</span>
      </div>";
        exit;
    }
    return $ip_data;
}

// Genera token seguro
function generar_token() {
    return bin2hex(random_bytes(32));
}

// Envía token al correo del usuario
function send_token_email($email, $user, $token) {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'lottocampuzano@gmail.com';
        $mail->Password = 'fycz bhkj cbmr yclh'; // Usa variable de entorno o archivo seguro en producción
        $mail->SMTPSecure = 'tls';
        $mail->Port = 587;

        $mail->setFrom('lottocampuzano@gmail.com', 'Gmail');
        $mail->addAddress($email, $user);
        $mail->isHTML(true);
        $mail->Subject = 'Tu token de acceso';
        $mail->Body = "Hola <strong>$user</strong>, tu token es: <b>$token</b>";
        $mail->send();
        echo "<div class='bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Éxito:</strong>
        <span class='block sm:inline'>Se ha enviado el token a tu correo.</span>
      </div>";
    } catch (Exception $e) {
        echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Error:</strong>
        <span class='block sm:inline'>Error al enviar el token: " . htmlspecialchars($mail->ErrorInfo) . ".</span>
      </div>";
    }
}

// ========================
// LOGIN
// ========================
if (isset($_POST["login"])) {
    $user = filter_input(INPUT_POST, 'usuario', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $pass = $_POST['contraseña'];

    $ip_data = is_ip_blocked($pdo, $ip);

    // Verificar existencia del usuario
    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usr = :usuario");
    $stmt->execute(['usuario' => $user]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    $now = new DateTime();
    if ($usuario && $usuario['tiempo'] && $now < new DateTime($usuario['tiempo'])) {
        echo "<div class='bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Aviso:</strong>
        <span class='block sm:inline'>El usuario está bloqueado hasta: " . htmlspecialchars($usuario['tiempo']) . ".</span>
      </div>";
        exit;
    }

    if ($usuario && password_verify($pass, $usuario['pass'])) {
        session_regenerate_id(true); // Regenera ID de sesión para seguridad
        $_SESSION['usuario'] = $user;
        $_SESSION['ultimo_acceso']=time();
        // Login exitoso
        $token = generar_token();
        $stmt = $pdo->prepare("UPDATE usuarios SET token = :token, intento = 0, tiempo = NULL WHERE usr = :usuario");
        $stmt->execute(['token' => $token, 'usuario' => $user]);

        send_token_email($usuario['email'], $user, $token);

        if ($ip_data) {
            $stmt = $pdo->prepare("UPDATE ips_bloqueadas SET intentos = 0, bloqueado_hasta = NULL WHERE ip = :ip");
            $stmt->execute(['ip' => $ip]);
        }

        header("Location: /php/verificar.php");
        exit;
    } else {
        $usuario_intentos = $usuario ? $usuario['intento'] + 1 : 0;
        $ip_intentos = $ip_data ? $ip_data['intentos'] + 1 : 1;

        // Bloqueo por usuario
        if ($usuario && $usuario_intentos >= 5) {
            $bloqueo_usuario = (new DateTime('+10 minutes'))->format('Y-m-d H:i:s');
            $stmt = $pdo->prepare("UPDATE usuarios SET intento = :intento, tiempo = :tiempo WHERE usr = :usuario");
            $stmt->execute(['intento' => $usuario_intentos, 'tiempo' => $bloqueo_usuario, 'usuario' => $user]);
            echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Error:</strong>
        <span class='block sm:inline'>Usuario bloqueado por múltiples intentos fallidos.</span>
      </div>";
            exit;
        } elseif ($usuario) {
            $stmt = $pdo->prepare("UPDATE usuarios SET intento = :intento WHERE usr = :usuario");
            $stmt->execute(['intento' => $usuario_intentos, 'usuario' => $user]);
        }

        // Bloqueo por IP
        if ($ip_intentos >= 10) {
            $bloqueo_ip = (new DateTime('+10 minutes'))->format('Y-m-d H:i:s');
            if ($ip_data) {
                $stmt = $pdo->prepare("UPDATE ips_bloqueadas SET intentos = :intentos, bloqueado_hasta = :bloqueado WHERE ip = :ip");
                $stmt->execute(['intentos' => $ip_intentos, 'bloqueado' => $bloqueo_ip, 'ip' => $ip]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO ips_bloqueadas (ip, intentos, bloqueado_hasta) VALUES (:ip, :intentos, :bloqueado)");
                $stmt->execute(['ip' => $ip, 'intentos' => $ip_intentos, 'bloqueado' => $bloqueo_ip]);
            }
            echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Error:</strong>
        <span class='block sm:inline'>IP bloqueada por múltiples intentos fallidos.</span>
      </div>";
            exit;
        } else {
            if ($ip_data) {
                $stmt = $pdo->prepare("UPDATE ips_bloqueadas SET intentos = :intentos WHERE ip = :ip");
                $stmt->execute(['intentos' => $ip_intentos, 'ip' => $ip]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO ips_bloqueadas (ip, intentos) VALUES (:ip, :intentos)");
                $stmt->execute(['ip' => $ip, 'intentos' => $ip_intentos]);
            }
        }

        // Example of styled message for incorrect password
            echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
                        <strong class='font-bold'>Error:</strong>
                        <span class='block sm:inline'>Contraseña incorrecta. Intentos restantes del usuario: " . max(0, 5 - $usuario_intentos) . ". Intentos restantes por IP: " . max(0, 10 - $ip_intentos) . ".</span>
                        </div>";
    }
}

// ========================
// VERIFICACIÓN DE TOKEN
// ========================
if (isset($_POST['verificar'])) {
    $username = $_POST["usuario"];
    $token_ingresado = $_POST["token"];

    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usr = :username AND token = :token");
    $stmt->execute(['username' => $username, 'token' => $token_ingresado]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
       header("Location: /html/chat.html");

        $stmt = $pdo->prepare("UPDATE usuarios SET token = NULL WHERE usr = :usuario");
        $stmt->execute(['usuario' => $username]);

        $stmt = $pdo->prepare("DELETE FROM ips_bloqueadas WHERE ip = :ip");
        $stmt->execute(['ip' => $ip]);
    } else {
        echo "<div class='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
        <strong class='font-bold'>Error:</strong>
        <span class='block sm:inline'>Token inválido.</span>
      </div>";
    }
}
?>

<script src="https://cdn.tailwindcss.com"></script>
