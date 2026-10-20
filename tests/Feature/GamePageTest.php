<?php

namespace Tests\Feature;

use Tests\TestCase;

class GamePageTest extends TestCase
{
    /**
     * The home page serves the game: its canvas, script, manifest and service worker.
     */
    public function test_home_page_serves_the_game(): void
    {
        $response = $this->get(route('game'));

        $response->assertOk();
        $response->assertSee('<canvas id="gameCanvas" width="800" height="600"', false);
        $response->assertSee('space-invaders.js?v=', false);
        $response->assertSee('manifest.webmanifest', false);
        $response->assertSee("serviceWorker.register('", false);
    }

    /**
     * Every static file the page and service worker rely on exists in the web root.
     */
    public function test_game_assets_are_in_the_public_html_web_root(): void
    {
        $this->assertSame(base_path('public_html'), public_path());

        foreach (['space-invaders.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'ads.txt'] as $file) {
            $this->assertFileExists(public_path($file));
        }
    }
}
