<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Space Invaders</title>
    <meta name="description" content="Classic Space Invaders in your browser. Arrow keys to move, space to fire.">
    <meta name="theme-color" content="#111111">
    <link rel="icon" href="{{ asset('icon.svg') }}" type="image/svg+xml">
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Invaders">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        html, body {
            height: 100%;
            margin: 0;
            background: #0b0b12 radial-gradient(ellipse at top, #1a1a2e 0%, #0b0b12 70%);
            color: #fff;
            font-family: "Press Start 2P", "Courier New", monospace;
            touch-action: manipulation;
            -webkit-user-select: none;
            user-select: none;
        }
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100dvh;
            padding: 12px;
            gap: 12px;
        }
        #gameWrap {
            width: min(100%, 800px, calc((100dvh - 24px) * 4 / 3));
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        canvas {
            display: block;
            width: 100%;
            height: auto;
            aspect-ratio: 4 / 3;
            background: linear-gradient(to bottom, #15151f 0%, #000 100%);
            box-shadow: 0 0 40px #0ff6, inset 0 0 80px #0002;
            border: 2px solid #233;
            border-radius: 6px;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            cursor: pointer;
        }
        #account {
            display: flex;
            gap: 14px;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            font: 10px/1.4 "Press Start 2P", "Courier New", monospace;
            color: #9ad;
        }
        #account a, #account button {
            color: #ffd25a;
            background: none;
            border: 0;
            padding: 0;
            font: inherit;
            cursor: pointer;
            text-decoration: none;
        }
        #account a:hover, #account button:hover { color: #fff; }
        #account .who { color: #3cff5a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
        #account form { display: inline; }
        #account .status { color: #3cff5a; margin-right: auto; }
        #touchControls {
            display: none;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            width: 100%;
            padding-bottom: env(safe-area-inset-bottom);
        }
        #touchControls button {
            font: inherit;
            font-size: 18px;
            color: #3cff5a;
            background: #141a14;
            border: 2px solid #3cff5a66;
            border-radius: 10px;
            padding: 18px 0;
            touch-action: none;
            -webkit-tap-highlight-color: transparent;
        }
        #touchControls button:active { background: #1f3a22; border-color: #3cff5a; }
        #touchControls .tc-fire { color: #ffd25a; border-color: #ffd25a66; }
        #touchControls .tc-fire:active { background: #3a3215; border-color: #ffd25a; }
        @media (pointer: coarse) {
            #touchControls { display: grid; }
            #gameWrap { width: min(100%, 800px, calc((100dvh - 120px) * 4 / 3)); }
        }
        /* Landscape phones: float the buttons over the bottom corners so the
           canvas can use the full height. Drag-to-move works on the canvas too. */
        @media (pointer: coarse) and (orientation: landscape) and (max-height: 500px) {
            body { padding: 0; }
            #gameWrap { position: relative; width: min(100%, calc(100dvh * 4 / 3)); gap: 0; }
            canvas { border-radius: 0; border: 0; }
            #touchControls {
                position: absolute;
                left: 0; right: 0; bottom: 0;
                grid-template-columns: 1fr 1fr 1fr;
                padding: 0 8px 8px;
                pointer-events: none;
            }
            #touchControls button { pointer-events: auto; opacity: 0.55; padding: 14px 0; }
            #touchControls .tc-fire { justify-self: center; width: 40%; }
        }
        @media (prefers-reduced-motion: reduce) {
            canvas { box-shadow: none; }
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
    <div id="gameWrap">
        <nav id="account" aria-label="Account">
            @if (session('status'))
                <span class="status" role="status">{{ session('status') }}</span>
            @endif
            @auth
                <span class="who" title="{{ auth()->user()->email }}">{{ auth()->user()->name }}</span>
                <a href="{{ route('password.edit') }}">{{ auth()->user()->hasPassword() ? 'PASSWORD' : 'SET PASSWORD' }}</a>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit">SIGN OUT</button>
                </form>
            @else
                <a href="{{ route('login') }}">SIGN IN</a>
                <a href="{{ route('register') }}">CREATE ACCOUNT</a>
            @endauth
        </nav>
        <canvas id="gameCanvas" width="800" height="600" aria-label="Space Invaders game"></canvas>
    </div>
    <script src="{{ asset('space-invaders.js') }}?v={{ filemtime(public_path('space-invaders.js')) }}"></script>
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('{{ asset('sw.js') }}').catch(() => {}));
        }
    </script>
</body>
</html>
