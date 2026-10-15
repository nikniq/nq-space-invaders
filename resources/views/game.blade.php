<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Space Invaders</title>
    <link rel="icon" href="{{ asset('icon.svg') }}" type="image/svg+xml">
    <style>
        body {
            background: #111;
            margin: 0;
            overflow: hidden;
        }
        canvas {
            display: block;
            margin: 0 auto;
            background: linear-gradient(to bottom, #222 0%, #000 100%);
            box-shadow: 0 0 40px #0ff8;
        }
    </style>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-34RWEG01MV"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-34RWEG01MV');
    </script>
    <!-- End Google Analytics -->
</head>
<body>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <script src="{{ asset('space-invaders.js') }}"></script>
</body>
</html>
