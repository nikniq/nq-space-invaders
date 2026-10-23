<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title') · Space Invaders</title>
    <meta name="theme-color" content="#111111">
    <meta name="robots" content="noindex">
    <link rel="icon" href="{{ asset('icon.svg') }}" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0b0b12;
            --panel: rgba(20, 20, 34, 0.92);
            --line: #2a2a44;
            --text: #e8ecff;
            --muted: #9aa3d0;
            --green: #3cff5a;
            --gold: #ffd25a;
            --red: #ff5a6a;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        body {
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            background: var(--bg) radial-gradient(ellipse at top, #1d1a3e 0%, var(--bg) 70%);
            color: var(--text);
            font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        main {
            width: 100%;
            max-width: 420px;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 28px 24px;
            box-shadow: 0 0 40px #0ff2;
        }
        h1 {
            margin: 0 0 6px;
            font: 18px/1.4 "Press Start 2P", "Courier New", monospace;
            color: var(--green);
            text-shadow: 0 0 12px #3cff5a88;
        }
        .lead { margin: 0 0 22px; color: var(--muted); }
        label { display: block; margin: 14px 0 6px; font-size: 13px; color: var(--muted); }
        input[type=email], input[type=text], input[type=password] {
            width: 100%;
            padding: 11px 12px;
            border-radius: 8px;
            border: 1px solid var(--line);
            background: #0d0d18;
            color: var(--text);
            font: inherit;
        }
        input:focus { outline: 2px solid var(--green); outline-offset: 1px; border-color: transparent; }
        .check { display: flex; gap: 8px; align-items: center; margin-top: 12px; color: var(--muted); font-size: 13px; }
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            margin-top: 18px;
            padding: 12px 14px;
            border: 0;
            border-radius: 8px;
            font: 12px/1.4 "Press Start 2P", "Courier New", monospace;
            cursor: pointer;
            text-decoration: none;
        }
        .btn-primary { background: var(--green); color: #04140a; }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-google { background: #fff; color: #1f1f1f; font: 600 15px/1.4 system-ui, sans-serif; }
        .btn-google:hover { background: #f1f3f4; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0 4px; color: var(--muted); font-size: 12px; }
        .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--line); }
        details { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; }
        summary { cursor: pointer; color: var(--muted); font-size: 14px; }
        .status, .error {
            margin: 0 0 16px;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 14px;
        }
        .status { background: #10301a; border: 1px solid #3cff5a55; color: #c9ffd3; }
        .error { background: #3a1018; border: 1px solid #ff5a6a66; color: #ffd0d5; }
        .field-error { margin: 6px 0 0; color: var(--red); font-size: 13px; }
        .footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 14px; }
        a { color: var(--gold); }
        .hint { color: var(--muted); font-size: 13px; margin: 8px 0 0; }
        strong.email { color: var(--text); word-break: break-all; }
    </style>
</head>
<body>
    <main>
        @if (session('status'))
            <p class="status" role="status">{{ session('status') }}</p>
        @endif
        @error('google')
            <p class="error" role="alert">{{ $message }}</p>
        @enderror

        @yield('content')

        <div class="footer">
            <a href="{{ route('game') }}">← Back to the game</a>
            @yield('footer')
        </div>
    </main>
</body>
</html>
