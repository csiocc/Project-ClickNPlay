export class WaveManager {
    constructor(state, spawnEnemyCallback, showNotificationCallback) {
        this.state = state;
        this.spawnEnemy = spawnEnemyCallback;
        this.showNotification = showNotificationCallback;
    }

    getWaveConfig(wave) {
        const config = {
            count: 0,
            hpMultiplier: 1.0,
            typeDistribution: { run: 0, walk: 0, crawl: 0 }
        };

        // Basis-Anzahl und HP
        config.count = 20 + Math.floor(wave * 4); // Deutlich mehr Zombies pro Welle
        config.hpMultiplier = 1 + (wave - 1) * 0.08;

        // Verteilung der Zombie-Typen
        if (wave < 5) { // Anfangsphasen: Hauptsächlich langsame
            config.typeDistribution.run = 0.2;
            config.typeDistribution.crawl = 0.3;
        } else if (wave < 20) { // Mittelphase: Ausgewogener Mix
            config.typeDistribution.run = 0.3;
            config.typeDistribution.crawl = 0.25;
        } else if (wave < 50) { // Spätphase: Mehr schnelle Gegner
            config.typeDistribution.run = 0.5;
            config.typeDistribution.crawl = 0.15;
        } else { // End-Game: Überwiegend schnelle und sehr schnelle
            config.typeDistribution.run = 0.7;
            config.typeDistribution.crawl = 0.1;
        }
        config.typeDistribution.walk = 1.0 - config.typeDistribution.run - config.typeDistribution.crawl;

        return config;
    }

    startNextWave() {
        this.state.waveInProgress = true;
        const playerPos = this.state.player.position;
        const waveConfig = this.getWaveConfig(this.state.wave);
        for (let i = 0; i < waveConfig.count; i++) {
            setTimeout(() => {
                this.spawnEnemy(waveConfig, playerPos);
            }, i * 200); // Spawne alle 200ms einen Zombie
        }
    }

    cleanupZombies() {
        for (let i = this.state.enemies.length - 1; i >= 0; i--) {
            const enemy = this.state.enemies[i];
            if (enemy.model.position.y < -50) { // Zombie ist aus der Welt gefallen
                enemy.dispose();
                this.state.enemies.splice(i, 1);
            }
        }
    }

    update(dt) {
        // Reguläre Wellen
        if (this.state.enemies.length === 0 && !this.state.waveInProgress) {
            this.state.timeUntilNextWave -= dt;
            if (this.state.timeUntilNextWave <= 0) {
                this.state.wave++;
                this.showNotification(`Welle ${this.state.wave} beginnt!`, 2500, 'info');
                this.startNextWave();
                this.state.timeUntilNextWave = 5;
            }
        }

        // Zusätzliche Spawns
        if (!this.state.running || this.state.gameOver) return;

        this.state.timeUntilAmbientSpawn -= dt;
        if (this.state.timeUntilAmbientSpawn <= 0) {
            this.showNotification("Zusätzliche Gegner entdeckt!", 2000);
            const playerPos = this.state.player.position;
            // Nutze die Konfiguration der aktuellen Welle (oder Welle 1, falls noch keine gestartet ist)
            const waveConfig = this.getWaveConfig(Math.max(1, this.state.wave));
            
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    this.spawnEnemy(waveConfig, playerPos);
                }, i * 150); // Spawne sie mit leichter Verzögerung
            }
            this.state.timeUntilAmbientSpawn = 15; // Timer zurücksetzen
        }

        // Zombies aufräumen, die aus der Welt gefallen sind
        this.cleanupZombies();
    }
}