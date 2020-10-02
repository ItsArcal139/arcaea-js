(_ => {
    if(!_.dat) return;
    if(_.hasSetupDebugger) return;
    _.hasSetupDebugger = true;
    
    var gui = new dat.GUI();
    var currentGame = window.game;

    var Helper = {
        rebuildArcs: () => {
            currentGame.arcManager.rebuild()
        }
    };
    Object.defineProperty(Helper, "speed", {
        get: () => {
            return currentGame.gameplayManager.audioManager.speed;
        },
        set: (v) => {
            currentGame.gameplayManager.audioManager.setPlaybackRate(v);
        }
    });
    Object.defineProperty(Helper, "bpm", {
        get: () => {
            return !currentGame.chart ? 120 : Helper.speed * currentGame.chart.timingGroups[0].getBaseBpm();
        },
        set: (v) => {
            var base = !currentGame.chart ? 120 : currentGame.chart.timingGroups[0].getBaseBpm();
            currentGame.gameplayManager.audioManager.setPlaybackRate(v / base);
        }
    });

    var appearance = gui.addFolder("外觀設定");
    appearance.add(currentGame.timingManager, "dropRate").min(1).max(200).listen();
    appearance.add(Helper, "rebuildArcs");

    var audio = gui.addFolder("聲音設定");
    audio.add(currentGame.gameplayManager.audioManager, "semitoneOffset").min(-12).max(12).step(1).listen();
    audio.add(Helper, "speed").min(0).max(4).listen();
    audio.add(Helper, "bpm").min(60).max(255).listen();
})(window);
