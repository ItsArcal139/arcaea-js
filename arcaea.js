// arcaea.js -- by Kaka @ 2020
// Thanks to Arcade project by Schwarzer, I can make this viewer possible.
// Source: https://gitee.com/Schwarzer/Arcade/
/**
 * @typedef {"qi" | "qo" | "l" | "s" | "reset"} ArcCameraType
 * @typedef {"s" | "si" | "sisi" | "siso" | "so" | "sosi" | "soso" | "b"} ArcLineType
 * @typedef {0 | 1 | 2} ArcLineColor
 * @typedef {{
 *  x: number, y: number
 * }} TVector2
 * @typedef {TVector2 & {
 *  z: number
 * }} TVector3
 * @typedef {{
 *  position: TVector3,
 *  scale: TVector3,
 *  add: (obj: TObject3D) => void,
 *  remove: (obj: TObject3D) => void
 * }} TObject3D
 * @typedef {any} TColor
 * @typedef {any} TPlane
 * @typedef {any} TFace3
 * @typedef {{}} TMaterial
 * @typedef {TMaterial & {
 *  color: number | TColor,
 *  opacity: number,
 *  transparent: boolean,
 *  clippingPlanes: TPlane[]
 * }} TMeshBasicMaterial
 * @typedef {{
 *  vertices: TVector2[],
 *  faces: TFace3[],
 *  faceVertexUvs: TVector2[][]
 * }} TGeometry
 * @typedef {{
 *  material: TMaterial,
 *  geometry: TGeometry
 * } & TObject3D} TMesh
 */

var ArcAlgorithm = {
    /**
     * Converts the X value from Arcaea space to world space.
     * @param {number} x
     */
    arcXToWorld: (x) => {
        return -8.5 * x + 4.25;
    },

    /**
     * Converts the Y value from Arcaea space to world space.
     * @param {number} y
     */
    arcYToWorld: (y) => {
        return 1 + 4.5 * y;
    },

    /**
     * Converts the X value from world space to Arcaea space.
     * @param {number} x
     */
    worldXToArc: (x) => {
        return (x - 4.25) / -8.5;
    },
    /**
     * Converts the Y value from world space to Arcaea space.
     * @param {number} y
     */
    worldYToArc: (y) => {
        return (y - 1) / 4.5;
    },

    /**
     * Apply linear interpolation with a range and a progress.
     * @param {number} a The start value.
     * @param {number} b The end value.
     * @param {number} t The progress.
     */
    s: (a, b, t) => {
        return (1 - t) * a + b * t;
    },

    /**
     * Apply cosine interpolation with a range and a progress.
     * @param {number} a The start value.
     * @param {number} b The end value.
     * @param {number} t The progress.
     */
    o: (a, b, t) => {
        return a + (b - a) * (1 - Math.cos(1.5707963 * t));
    },

    /**
     * Apply sine interpolation with a range and a progress.
     * @param {number} a The start value.
     * @param {number} b The end value.
     * @param {number} t The progress.
     */
    i: (a, b, t) => {
        return a + (b - a) * Math.sin(1.5707963 * t);
    },

    /**
     * Apply cubic interpolation with a range and a progress.\
     * Returns `ap^3 + 3tap^2 + 3pbt^2 + bt^3 (p=1-t)`.
     * @param {number} a The start value.
     * @param {number} b The end value.
     * @param {number} t The progress.
     */
    b: (a, b, t) => {
        var o = 1 - t;
        return Math.pow(o, 3) * a + 3 * Math.pow(o, 2) * t * a + 3 * o * Math.pow(t, 2) * b + Math.pow(t, 3) * b;
    },

    /**
     * @param {number} a
     * @param {number} b
     * @param {number} t
     * @param {ArcLineType} type
     */
    resolveX: (a, b, t, type) => {
        switch(type) {
            default:
            case "s":
                return ArcAlgorithm.s(a, b, t);
            case "b":
                return ArcAlgorithm.b(a, b, t);
            case "si":
            case "sisi":
            case "siso":
                return ArcAlgorithm.i(a, b ,t);
            case "so":
            case "sosi":
            case "soso":
                return ArcAlgorithm.o(a, b, t);
        }
    },

    /**
     * @param {number} a
     * @param {number} b
     * @param {number} t
     * @param {ArcLineType} type
     */
    resolveY: (a, b, t, type) => {
        switch(type) {
            default:
            case "s":
            case "si":
            case "so":
                return ArcAlgorithm.s(a, b, t);
            case "b":
                return ArcAlgorithm.b(a, b, t);
            case "sisi":
            case "sosi":
                return ArcAlgorithm.i(a, b ,t);
            case "siso":
            case "soso":
                return ArcAlgorithm.o(a, b, t);
        }
    },

    /**
     * @param {number} v
     */
    qi: (v) => {
        return Math.pow(v, 3);
    },
    /**
     * @param {number} v
     */
    qo: (v) => {
        return Math.pow(--v, 3) + 1;
    }
}

var Utils = {
    /**
     * @param {number} t
     * @param {number} a
     * @param {number} b
     */
    clamp: (t, a, b) => {
        return Math.max(a, Math.min(b, t));
    },

    /**
     * @param {number} num
     */
    numTo2f: (num) => {
        var d = (Math.abs(num) == 1 || Math.abs(num) == 0) ? 1 : Math.ceil(
            Math.log10(Math.abs(num)) + 0.00001
        );
        return num.toPrecision(2 + d);
    },
    
    lerp: (a, b, t) => {
        return a + (b - a) * Utils.clamp(t, 0, 1);
    }
}

class Chart {
    constructor() {
        /** @type {TimingGroup[]} */
        this.timingGroups = [];
        this.offset = 0;
    }

    /**
     * @param {string} raw 
     */
    static fromRaw(raw) {
        var chart = new Chart();
        var primary = new TimingGroup(true);
        var targetGroup = primary;
        chart.timingGroups.push(primary);

        var lines = raw.split("\n");
        lines.forEach((line, i) => {
            if(i == 0) {
                // Read the offset.
                var result = line.trim().match(/AudioOffset:(-?\d*)/);
                if(!result) {
                    throw new AffFormatError(`Invalid Arcaea chart format. Could't read AudioOffset.`);
                }
                chart.offset = parseFloat(result[1]);
                return;
            }

            if(i == 1) {
                if(line.trim() != "-") {
                    throw new AffFormatError(`Invalid Arcaea chart format. The 2nd line must be exactly "-".`);
                }
                return;
            }

            if(i >= 2) {
                if(line.startsWith("timinggroup(")) {
                    targetGroup = new TimingGroup();
                    chart.timingGroups.push(targetGroup);
                } else if(line.startsWith("};")) {
                    targetGroup = primary;
                } else {
                    var event = ArcaeaEvent.fromRaw(line.trim(), targetGroup, i);
                    if(event) targetGroup.events.push(event);
                }
            }
        });

        return chart;
    }

    /**
     * Export the `Chart` to Arcaea chart format string.
     * @param {boolean} fixOffset Whether to make `AudioOffset` be 0.\
     *                            You may be required to adjust the base timing event time manually.
     */
    export(fixOffset) {
        var header = "AudioOffset:" + (fixOffset ? 0 : this.offset) + "\n";
        header += "-\n";
        return header + this.timingGroups.map(t => t.export(fixOffset ? this.offset : 0)).join("");
    }

    static async download(url) {
        return Chart.fromRaw(await (await fetch(url, {
            cache: "no-cache"
        })).text());
    }

    /**
     * @return {TapNote[]}
     */
    taps() {
        var result = [];
        this.timingGroups.forEach(t => {
            result.push.apply(result, t.events.filter(e => {
                return e instanceof TapNote;
            }));
        });
        return result;
    }

    /**
     * @return {Arc[]}
     */
    arcs() {
        var result = [];
        this.timingGroups.forEach(t => {
            result.push.apply(result, t.events.filter(e => {
                return e instanceof Arc;
            }));
        });
        return result;
    }

    /**
     * @return {HoldNote[]}
     */
    holds() {
        var result = [];
        this.timingGroups.forEach(t => {
            result.push.apply(result, t.events.filter(e => {
                return e instanceof HoldNote;
            }));
        });
        return result;
    }

    /**
     * @return {CameraEvent[]}
     */
    cameras() {
        var result = [];
        this.timingGroups.forEach(t => {
            result.push.apply(result, t.events.filter(e => {
                return e instanceof CameraEvent;
            }));
        });
        return result;
    }

    getPrimaryTimingGroup() {
        return this.timingGroups[0];
    }
}

class AffFormatError extends Error {
    constructor(msg) {
        super(msg);
    }
}

class TimingGroup {
    constructor(isPrimary = false) {
        this.isPrimary = isPrimary;

        /** @type {ArcaeaEvent[]} */
        this.events = [];

        /** @type {number[]} */
        this.keyTimes = [];
        this.pairCount = 0;
        this.starts = [];
        this.ends = [];

        /** @type {TimingEvent[]} */
        this.timings = null;
    }

    export(offset = 0) {
        var content = "";
        if(!this.isPrimary) {
            content += "timinggroup(){\n";
        }

        content += this.events.map(e => {
            return (this.isPrimary ? "" : "    ") + e.export(offset) + "\n";
        }).join("");

        if(!this.isPrimary) {
            content += "};\n";
        }

        return content;
    }

    getBaseBpm() {
        /** @type {TimingEvent} */
        var event = this.getTimingEvents()[0];

        if(!event) {
            throw new AffFormatError("Invalid Arcaea file format. The timing group has no timing event.");
        }
        return event.bpm;
    }

    /** @return {TimingEvent[]} */
    getTimingEvents() {
        if(this.timings == null) {
            this.timings = Object.freeze(this.events.filter(n => {
                return n instanceof TimingEvent;
            }).sort((a, b) => {
                return a.time - b.time
            }));
        }
        return this.timings;
    }

    /**
     * @param {number} timing 
     */
    getBpmByTiming(timing) {
        var timings = this.getTimingEvents();
        for(var i=0; i<timings.length - 1; i++) {
            if(
                timing > timings[i].time &&
                timing < timings[i+1].time
            ) {
                return timings[i].bpm;
            }
        }
        return timings[timings.length - 1].bpm;
    }

    /**
     * @param {number} timing 
     */
    getPosByTiming(timing) {
        return this.getPosByTimingWithStart(GameplayManager.instance.timing, timing);
    }

    /**
     * 
     * @param {number} pos 
     * @param {number} depth 
     */
    getTimingByPos(pos, depth = 0) {
        var timings = this.getTimingEvents();
        var start = 0;
        var end = timings.length - 1;
        var breakPos = -1;
        var startPos = 0;
        var endPos = pos;

        var gm = GameplayManager.instance;
        var offset = gm.audioManager.offset;
        var time = gm.timing;
        var songLength = gm.length;

        for(var i=0; i<timings.length - 1; i++) {
            if(time >= timings[i].time + offset && time < timings[i+1].time + offset) start = i;
        }
        if(time >= timings[end].time + offset) start = end;

        var depthCount = 0;
        var delta = 0;
        var endTime = 0;

        if(start != end) {
            for(var i=start; i<=end; i++) {
                if(i == start) {
                    delta = (timings[i+1].time + offset - time) * (timings[i].bpm / this.getBaseBpm()) * this.getDropRate();
                    if((startPos + delta <= endPos && startPos >= endPos) || (startPos + delta >= endPos && startPos <= endPos)) {
                        if(depth == depthCount) {
                            breakPos = i;
                            break;
                        } else {
                            depthCount++;
                        }
                    }
                    startPos += delta;
                } else if(i != end && i != start) {
                    delta = (timings[i+1].time - timings[i].time) * (timings[i].bpm / this.getBaseBpm()) * this.getDropRate();
                    if((startPos + delta < endPos && startPos > endPos) || (startPos + delta > endPos && startPos < endPos)) {
                        if(depth == depthCount) {
                            breakPos = i;
                            break;
                        } else {
                            depthCount++;
                        }
                    }
                    startPos += delta;
                } else if(i == end) {
                    delta = (songLength - timings[i].time - offset) * (timings[i].bpm / this.getBaseBpm()) * this.getDropRate();
                    if((startPos + delta < endPos && startPos > endPos) || (startPos + delta > endPos && startPos < endPos)) {
                        if(depth == depthCount) {
                            breakPos = i;
                            break;
                        } else {
                            depthCount++;
                        }
                    }
                    startPos += delta;
                }
            }
        } else if(start == end) {
            delta = (endPos - startPos);
            endTime = delta / (((timings[end].bpm || 1) / this.getBaseBpm()) * this.getDropRate()) + time;
            if(endTime > songLength) return songLength;
            return Math.floor(endTime);
        }

        if(breakPos == start) {
            delta = (endPos - startPos);
            if(delta == 0) {
                if(timings[breakPos].bpm == 0) endTime = timings[breakPos].time + offset;
                else endTime = time;
            } else {
                endTime = delta / (((timings[breakPos].bpm || 1) / this.getBaseBpm()) * this.getDropRate()) + time;
            }
        } else if(breakPos != -1) {
            delta = (endPos - startPos);
            endTime = delta / (((timings[breakPos].bpm || 1) / this.getBaseBpm()) * this.getDropRate()) + timings[breakPos].time + offset;
        } else if(breakPos == -1) {
            endTime = songLength;
        }

        if(endTime > songLength) {
            return songLength;
        } else {
            return Math.floor(endTime);
        }
    }

    /**
     * @return {number}
     */
    getDropRate() {
        return TimingManager.instance.dropRate;
    }

    /**
     * 
     * @param {number} start 
     * @param {number} timing 
     */
    getPosByTimingWithStart(start, timing) {
        var offset = GameplayManager.instance.audioManager.offset;
        var current = start > timing ? timing : start;
        var target = start > timing ? start : timing;
        var reverse = start > timing;

        current -= offset;
        target -= offset;
        offset = 0;

        var pos = 0;
        var a = 0;
        var b = 0;

        var timings = this.getTimingEvents();
        for(var i=0; i<timings.length-1; i++) {
            if(current >= timings[i].time + offset && current < timings[i+1].time + offset) {
                a = i;
                break;
            }
        }
        for(var i=0; i<timings.length-1; i++) {
            if(target >= timings[i].time + offset && target < timings[i+1].time + offset) {
                b = i;
                break;
            }
        }

        if(timings.length != 0) {
            if(current >= timings[timings.length - 1].time + offset) a = timings.length - 1;
            if(target >= timings[timings.length - 1].time + offset) b = timings.length - 1;
        }

        var base = this.getBaseBpm();
        var dropRate = this.getDropRate();

        if(a == b) {
            pos += (target - current) * timings[a].bpm / base * dropRate;
        } else {
            for(var i=a; i<=b; i++) {
                if(i == a) pos += (timings[i+1].time + offset - current) * timings[i].bpm / base * dropRate;
                else if(i != a && i != b) pos += (timings[i+1].time - timings[i].time - offset) * timings[i].bpm / base * dropRate;
                else if(i == b) pos += (target - timings[i].time + offset) * timings[i].bpm / base * dropRate;
            }
        }

        return reverse ? -pos : pos;
    }

    /**
     * 
     * @param {number} time 
     * @param {number} delay 
     */
    shouldRender(time, delay = 120) {
        for(var i=0; i<this.pairCount; ++i) {
            if(time >= this.starts[i] - delay && time <= this.ends[i]) return true;
        }
        return false;
    }

    updateRenderRange() {
        this.pairCount = 0;
        this.keyTimes = [];

        this.keyTimes.push(
            GameplayManager.instance.timing,
            GameplayManager.instance.timing,
            this.getTimingByPos(0, 0),
            this.getTimingByPos(100000, 0)
        );

        for(var i=0; i<this.keyTimes.length; i += 2) {
            this.starts[this.pairCount] = this.keyTimes[i];
            this.ends[this.pairCount] = this.keyTimes[i+1];
            this.pairCount++;
        }
    }
}

class AffExportError extends Error {
    /** 
     * @param {string | null} msg
     */
    constructor(msg = null) {
        super(msg);
    }
}

class ArcaeaEvent {
    /** 
     * @param {TimingGroup} timingGroup
     * @param {number} time 
     */
    constructor(timingGroup, time) {
        /** An integer represents the note time in milliseconds. */
        this.time = time;

        /** @type {TimingGroup} */
        this.timingGroup = timingGroup;
        this.gameObject = new THREE.Object3D();
    }

    export(offset = 0) {
        console.error(this);
        throw new AffExportError("This event cannot be exported.");
    }

    canBeRendered() {
        return false;
    }

    /**
     * 
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     * @returns {ArcaeaEvent}
     */
    static fromRaw(line, timingGroup, i) {
        var index = line.indexOf("(");
        if(index == -1) {
            return null;
        }

        var type = line.substring(0, index);
        switch(type) {
            case "":
                return TapNote.fromRaw(line, timingGroup);
            case "hold":
                return HoldNote.fromRaw(line, timingGroup);
            case "arc":
                return Arc.fromRaw(line, timingGroup);
            case "timing":
                return TimingEvent.fromRaw(line, timingGroup);
            case "camera":
                return CameraEvent.fromRaw(line, timingGroup);
            default:
                throw new AffFormatError(`Unknown event type: ${type}.`);
        }
    }
}

class ArcaeaJudgableEvent extends ArcaeaEvent {
    /**
     * 
     * @param {TimingGroup} timingGroup 
     * @param {number} time 
     */
    constructor(timingGroup, time) {
        super(timingGroup, time);

        this.enabled = true;
        this.judging = false;
        this.judged = false;
        this.position = 0;
    }
}

class TapNote extends ArcaeaJudgableEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time An integer represents the note time in milliseconds.
     * @param {number} lane An integer between 1 to 4, represents the lane of the note.
     */
    constructor(timingGroup, time, lane) {
        super(timingGroup, time);

        /** An integer between 1 to 4, represents the lane of the note. */
        this.lane = lane;
    }

    export(offset = 0) {
        return `(${this.time + offset},${this.lane});`;
    }

    canBeRendered() {
        return true;
    }

    /** 
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     */
    static fromRaw(line, timingGroup) {
        var result = line.match(/\((.*?),(.*?)\)/);
        return new TapNote(timingGroup, parseInt(result[1]), parseInt(result[2]));
    }

    static newObject() {
        var loader = new THREE.TextureLoader();
        var texture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/TapNote.png");

        var material = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0x8dcee6 : 0xffffff,
            map: texture,
            transparent: true
        });
        var geometry = new THREE.PlaneGeometry(1, 1);
        var obj = new THREE.Mesh(geometry, material);
        obj.position.x = -ArcAlgorithm.arcXToWorld(-0.25);
        obj.position.y = 0.11;
        obj.position.z = -0.5;
        obj.scale.x = 4.2746 * 0.95;
        obj.scale.y = 2.3;
        obj.scale.z = 1 * 0.95;
        obj.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
        return obj;
    }

    setupArcTapConnection() {
        ArcManager.instance.arcs.forEach(a => {
            if(a.arcTaps.length == 0) return;
            a.arcTaps.forEach(t => {
                if(Math.abs(t.time - this.time) <= 1) {
                    t.setupArcTapConnection();
                }
            });
        });
    }

    destroy() {
        GameplayManager.instance.game.scene.remove(this.gameObject);
    }
}

class HoldNote extends ArcaeaJudgableEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time An integer represents the note time in milliseconds.
     * @param {number} endTime An integer represents the end of the holding time in milliseconds.
     * @param {number} lane An integer between 1 to 4, represents the lane of the note.
     */
    constructor(timingGroup, time, endTime, lane) {
        super(timingGroup, time);

        /** An integer represents the end of the holding time in milliseconds. */
        this.endTime = endTime;

        /** An integer between 1 to 4, represents the lane of the note. */
        this.lane = lane;
        this.audioPlayed = false;
        this.shouldPlayAudio = false;

        /** @type {number[]} */
        this.judgeTimings = [];
    }

    export(offset = 0) {
        return `hold(${this.time + offset},${this.endTime + offset},${this.lane});`;
    }

    canBeRendered() {
        return true;
    }

    /**
     * 
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     */
    static fromRaw(line, timingGroup) {
        var result = line.match(/hold\((.*?),(.*?),(.*?)\)/);
        return new HoldNote(timingGroup, parseInt(result[1]), parseInt(result[2]), parseInt(result[3]));
    }

    calculateJudgeTimings() {
        this.judgeTimings = [];
        var u = 0;
        var g = this.timingGroup;

        var bpm = g.getBpmByTiming(this.time);
        if(bpm <= 0) return;
        var interval = 60000 / bpm / (bpm >= 255 ? 1 : 2);
        var total = Math.floor((this.endTime - this.time) / interval);

        if(u ^ 1 > total) {
            this.judgeTimings.push(Math.floor(this.time + (this.endTime - this.time) * 0.5));
            return;
        }

        var n = u ^ 1;
        while(true) {
            var t = Math.floor(this.time + n * interval);
            if(t < this.endTime) {
                this.judgeTimings.push(t);
            }
            if(total == ++n) break;
        }
    }

    static newObject() {
        var loader = new THREE.TextureLoader();
        var texture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/HoldNote.png");

        var material = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0x8dcee6 : 0xffffff,
            map: texture,
            transparent: true,
            clippingPlanes: [
                new THREE.Plane( new THREE.Vector3( 0, 0, -1 ), 0 ),
                new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), 100)
            ]
        });
        var geometry = new THREE.PlaneGeometry(1, 1);
        var obj = new THREE.Mesh(geometry, material);
        obj.position.x = -ArcAlgorithm.arcXToWorld(-0.25);
        obj.position.y = 0.11;
        obj.position.z = -0.5;
        obj.scale.x = 4.2746 * 0.95;
        obj.scale.y = 1.53 * 0.95;
        obj.scale.z = 1 * 0.95;
        obj.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
        return obj;
    }

    destroy() {
        GameplayManager.instance.game.scene.remove(this.gameObject);
    }
}

class Vector2 {
    /**
     * @param {number} x 
     * @param {number} y 
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    toVector3(z = 0) {
        return new Vector3(this.x, this.y, z);
    }

    /**
     * @param {Vector2} a 
     * @param {Vector2} b 
     * @param {number} t 
     * @param {ArcLineType} type 
     */
    static tween(a, b, t, type = "s") {
        return new Vector2(
            ArcAlgorithm.resolveX(a.x, b.x, t, type),
            ArcAlgorithm.resolveY(a.y, b.y, t, type),
        );
    }
}

class Vector3 {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    equals(v) {
        if(!(v instanceof Vector3)) return false;
        return (v.x == this.x && v.y == this.y && v.z == this.z);
    }

    /**
     * 
     * @param {Vector3} vector 
     */
    addToSelf(vector) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;
    }

    /**
     * 
     * @param {Vector3} vector 
     */
    add(vector) {
        var result = new Vector3(this.x, this.y, this.z);
        result.x += vector.x;
        result.y += vector.y;
        result.z += vector.z;
        return result;
    }

    /**
     * 
     * @param {number} n 
     * @returns {Vector3}
     */
    times(n) {
        return new Vector3(
            this.x * n,
            this.y * n,
            this.z * n
        );
    }
}

class ArctapNote extends ArcaeaJudgableEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time 
     * @param {Arc} arc 
     */
    constructor(timingGroup, time, arc) {
        super(timingGroup, time);
        this.parent = arc;
        this.shadow = new THREE.Group();

        this.connections = [];
    }

    export(offset = 0) {
        return `arctap(${this.time + offset});`;
    }

    canBeRendered() {
        return true;
    }

    destroy() {
        GameplayManager.instance.game.scene.remove(this.gameObject);
        GameplayManager.instance.game.scene.remove(this.shadow);
        this.removeArcTapConnection();
    }

    rebuild() {
        this.destroy();
        this.gameObject = ArctapNote.newObject();
        this.shadow = ArctapNote.newShadow();
        GameplayManager.instance.game.scene.add(this.gameObject);
        GameplayManager.instance.game.scene.add(this.shadow);

        this.setupArcTapConnection();
    }

    static newObject() {
        var loader = new THREE.TextureLoader();
        var texture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/ArcTapLight.png");
        if(texture) {
            texture.anisotropy = 16;
        }

        var material = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0xbeb6da : 0xffffff,
            map: texture,
            transparent: true,
        });
        var geometry = new THREE.BoxGeometry(1, 1);

        /** @type {TObject3D} */
        var obj = new THREE.Mesh(geometry, material);
        obj.position.x = -ArcAlgorithm.arcXToWorld(-0.25);
        obj.position.y = 0.11;
        obj.position.z = -0.5;
        obj.scale.x = 4.2746 * 0.95;
        obj.scale.y = 0.8 * 0.95;
        obj.scale.z = 0.8 * 0.95;
        obj.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
        return obj;
    }

    static newShadow() {
        var material = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            transparent: true
        });
        var geometry = new THREE.PlaneGeometry(1, 1);

        /** @type {TObject3D} */
        var obj = new THREE.Mesh(geometry, material);
        obj.position.x = -ArcAlgorithm.arcXToWorld(-0.25);
        obj.position.y = 0.11;
        obj.position.z = -0.5;
        obj.scale.x = 4.2746 * 0.95;
        obj.scale.y = 0.8 * 0.95;
        obj.scale.z = 0.8 * 0.95;
        obj.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
        return obj;
    }

    setupArcTapConnection() {
        var arc = this.parent;
        if(!arc || (arc.endTime - arc.time) == 0) return;

        var taps = TapNoteManager.instance.taps;
        var sameTimeTaps = taps.filter(s => {
            return Math.abs(s.time - this.time) < 1 && s.timingGroup == this.timingGroup
        });

        sameTimeTaps.forEach(t => {
            var material = new THREE.MeshBasicMaterial({
                color: 0x78c8dc,
                transparent: true
            });
            var p = (this.time - arc.time) / (arc.endTime - arc.time);
            var posA = new Vector2(-ArcAlgorithm.arcXToWorld(ArcAlgorithm.resolveX(arc.start.x, arc.end.x, p, arc.lineType)), ArcAlgorithm.arcYToWorld(ArcAlgorithm.resolveY(arc.start.y, arc.end.y, p, arc.lineType)) - 0.5);
            var posB = new Vector2(TapNoteManager.instance.lanes[t.lane - 1], 0.11);
            
            var geometry = new THREE.Geometry();
            geometry.vertices.push(
                new THREE.Vector3(posA.x - 0.1, posA.y, 0), 
                new THREE.Vector3(posA.x + 0.1, posA.y, 0), 
                new THREE.Vector3(posB.x - 0.1, posB.y, 0),
                new THREE.Vector3(posB.x + 0.1, posB.y, 0),
            );
            var uv = [
                new THREE.Vector2(0, 1),
                new THREE.Vector2(1, 1),
                new THREE.Vector2(0, 0),
                new THREE.Vector2(1, 0)
            ]
            geometry.faces.push(
                new THREE.Face3(0, 2, 1),
                new THREE.Face3(1, 2, 3)
            );
            geometry.faceVertexUvs[0].push(
                [uv[0], uv[2], uv[1]],
                [uv[1], uv[2], uv[3]]
            );

            var line = new THREE.Mesh(geometry, material);

            this.connections.filter(c => {
                return c.tap == t;
            }).forEach(el => {
                GameplayManager.instance.game.scene.remove(el.line);
                var i = this.connections.indexOf(el);
                if(i != -1) this.connections.splice(i, 1);
            });

            GameplayManager.instance.game.scene.add(line);
            this.connections.push({
                line, tap: t
            });
        });
    }

    removeArcTapConnection() {
        this.connections.forEach(el => {
            GameplayManager.instance.game.scene.remove(el.line);
            var i = this.connections.indexOf(el);
            if(i != -1) this.connections.splice(i, 1);
        });
    }
}

class ArcSegment {
    constructor() {
        /** @type {TGeometry} */
        this.geometry = new THREE.Geometry();
        /** @type {TGeometry} */
        this.shadowGeometry = new THREE.Geometry();

        this.fromPos = new Vector3(0, 0, 0);
        this.toPos = new Vector3(0, 0, 0);
        this.fromTiming = 0;
        this.toTiming = 0;
        
        /** @type {TObject3D[]} */
        this.objects = [new THREE.Object3D(), new THREE.Object3D()];

        this.enabled = true;

        this.from = 0;
    }

    build(fromPos, toPos, offset, from, to) {
        this.fromTiming = from;
        this.toTiming = to;
        this.fromPos = fromPos;
        this.toPos = toPos;

        if(fromPos.equals(toPos)) return;

        var vertices = [];
        var uv = [];

        vertices[0] = fromPos.add(new Vector3(0, offset / 2, 0));
        uv[0] = new THREE.Vector2(0, 0);
        vertices[1] = toPos.add(new Vector3(0, offset / 2, 0));
        uv[1] = new THREE.Vector2(0, 1);
        vertices[2] = toPos.add(new Vector3(offset, -offset / 2, 0));
        uv[2] = new THREE.Vector2(1, 1);
        vertices[3] = fromPos.add(new Vector3(offset, -offset / 2, 0));
        uv[3] = new THREE.Vector2(1, 0);
        vertices[4] = toPos.add(new Vector3(-offset, -offset / 2, 0));
        uv[4] = new THREE.Vector2(1, 1);
        vertices[5] = fromPos.add(new Vector3(-offset, -offset / 2, 0));
        uv[5] = new THREE.Vector2(1, 0);

        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push.apply(this.geometry.vertices, vertices);
        this.geometry.faces.push(
            new THREE.Face3(0, 3, 2),
            new THREE.Face3(0, 2, 1),
            new THREE.Face3(0, 4, 5),
            new THREE.Face3(0, 1, 4),
        );

        this.geometry.faceVertexUvs[0].push(
            [uv[0], uv[3], uv[2]],
            [uv[0], uv[2], uv[1]],
            [uv[0], uv[4], uv[5]],
            [uv[0], uv[1], uv[4]],
        );
        this.geometry.computeFaceNormals();
        this.geometry.uvsNeedUpdate = true;

        var shadowUv = [];
        shadowUv.push(
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, 1),
            new THREE.Vector2(1, 1),
            new THREE.Vector2(1, 0),
        )
        this.shadowGeometry = new THREE.Geometry();
        this.shadowGeometry.vertices.push(
            fromPos.add(new Vector3(-offset, -fromPos.y, 0)),
            toPos.add(new Vector3(-offset, -toPos.y, 0)),
            toPos.add(new Vector3(offset, -toPos.y, 0)),
            fromPos.add(new Vector3(offset, -fromPos.y, 0))
        );
        this.shadowGeometry.faces.push(
            new THREE.Face3(0, 2, 1),
            new THREE.Face3(0, 3, 2)
        );
        this.shadowGeometry.faceVertexUvs[0].push(
            [uv[0], uv[1], uv[2]],
            [uv[0], uv[2], uv[3]],
        );
        this.shadowGeometry.computeFaceNormals();
        this.shadowGeometry.uvsNeedUpdate = true;
    }

    destroy() {
        this.geometry.dispose();
        this.shadowGeometry.dispose();
    }
}

class ArcRenderer {
    /**
     * 
     * @param {Arc} arc 
     */
    constructor(arc) {
        this.arc = arc;

        /** @type {ArcSegment[]} */
        this.segments = [];
        this.enableHeightIndicator = true;

        /** @type {TObject3D} */
        this.heightIndicator = new THREE.Object3D();
        this.segCount = 0;
        this.color = new THREE.Color(0, 0, 0);

        this.enableEffect = false;
        this.enableArcCap = false;
        this.highlight = false;
        this.arcCap = null;
        this.head = null;
    }

    /**
     * 
     * @param {Arc} arc 
     */
    setArc(arc) {
        this.arc = arc;
        this.build();
    }

    cleanSegments() {
        this.segments.forEach(s => {
            s.destroy();
        });
        this.segments = [];
    }

    destroy() {
        this.cleanSegments();
    }

    build() {
        var group = new THREE.Group();
        this.buildHeightIndicator();
        this.buildSegments();
        this.buildHead();
        this.buildArcCap();

        var loader = new THREE.TextureLoader();
        var sTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/ArcBody.png");
        var sMaterial = new THREE.MeshBasicMaterial({
            color: this.color.getHex(),
            opacity: this.arc.isVoid ? 0.4166 : 0.572549,
            transparent: true,
            map: sTexture,
            clippingPlanes: [
                new THREE.Plane( new THREE.Vector3( 0, 0, -1 ), 0),
                new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), 100)
            ],
            side: THREE.DoubleSide
        });
        var sdMaterial = new THREE.MeshBasicMaterial({
            color: this.arc.isVoid ? 0xaaaaaa : 0x888888,
            transparent: true,
            opacity: 0,
            clippingPlanes: [
                new THREE.Plane( new THREE.Vector3( 0, 0, -1 ), 0),
                new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), 100)
            ]
        });

        var segmentGroup = new THREE.Group();
        var shadowGroup = new THREE.Group();

        this.segments.forEach(s => {
            try {
                var sGeometry = s.geometry;
                var sMesh = new THREE.Mesh(sGeometry, sMaterial.clone());
                sMesh.renderOrder = 999;
                segmentGroup.add(sMesh);
                
                var sdGeometry = s.shadowGeometry;
                var sdMesh = new THREE.Mesh(sdGeometry, sdMaterial.clone());
                shadowGroup.add(sdMesh);
                sdMesh.renderOrder = 9;
                sdMesh.position.set(0, 0.1, 0);

                s.objects = [sMesh, sdMesh];
            } catch(ex) {
                console.warn(ex);
            }
        });

        if(!this.arc.isVoid) group.add(this.heightIndicator);
        group.add(this.head, this.arcCap);
        group.add(segmentGroup, shadowGroup);
        this.arc.gameObject = group;
    }

    buildArcCap() {
        var arc = this.arc;

        var loader = new THREE.TextureLoader();
        var cTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/ArcCap.png");
        var plane = new THREE.PlaneGeometry(2.5, 2.5);
        var cMaterial = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0x6c526f : 0xffffff,
            map: cTexture,
            transparent: true,
            opacity: 1
        });

        var obj = new THREE.Mesh(plane, cMaterial);
        obj.renderOrder = 1000;
        obj.position.set(-ArcAlgorithm.arcXToWorld(arc.start.x), 0, 0);
        if(GameplayManager.instance.colorsOnly) {
            obj.setRotationFromEuler(new THREE.Euler(0, 0, Math.PI / 4));
        }
        this.arcCap = obj;
        obj.renderOrder = 10010;
    }

    buildHeightIndicator() {
        var arc = this.arc;
        if(arc.isVoid) {
            this.enableHeightIndicator = false;
            return;
        }

        var loader = new THREE.TextureLoader();
        var hTexture = GameplayManager.instance.colorsOnly ? null: loader.load("./assets/textures/HeightIndicator.png");
        var plane = new THREE.PlaneGeometry();
        var hMaterial = new THREE.MeshBasicMaterial({
            color: ArcRenderer.colors[arc.color].getHex(),
            map: hTexture,
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 0.572549,
            clippingPlanes: [
                new THREE.Plane( new THREE.Vector3( 0, 0, -1 ), 0)
            ]
        });

        var obj = new THREE.Mesh(plane, hMaterial);
        obj.renderOrder = 1000;
        obj.position.set(-ArcAlgorithm.arcXToWorld(arc.start.x), 0, 0);
        obj.scale.set(GameplayManager.instance.colorsOnly ? 0.4 : 2.34, 2 * (ArcAlgorithm.arcYToWorld(arc.start.y) - ArcRenderer.offsetNormal / 2), 1);
        this.heightIndicator = obj;
    }

    buildSegments() {
        var arc = this.arc;
        if(!arc) return;

        var g = arc.timingGroup;
        var offset = GameplayManager.instance.audioManager.offset;
        var duration = arc.endTime - arc.time;

        var v1 = duration < 1000 ? 14 : 7;
        var v2 = duration == 0 ? 0 : 1 / (v1 * duration / 1000);
        var segSize = Math.floor(duration * v2);
        this.segCount = Math.floor(segSize == 0 ? 0 : duration / segSize) + 1;

        this.instantiateSegments(this.segCount);

        var start = new Vector3();
        var end = new Vector3(
            -ArcAlgorithm.arcXToWorld(arc.start.x),
            ArcAlgorithm.arcYToWorld(arc.start.y)
        );

        for(var i=0; i<this.segCount-1; i++) {
            start = end;
            end = new Vector3(
                -ArcAlgorithm.arcXToWorld(ArcAlgorithm.resolveX(arc.start.x, arc.end.x, (i + 1) * segSize / duration, arc.lineType)),
                ArcAlgorithm.arcYToWorld(ArcAlgorithm.resolveY(arc.start.y, arc.end.y, (i + 1) * segSize / duration, arc.lineType)),
                -g.getPosByTimingWithStart(arc.time + offset, arc.time + offset + segSize * (i + 1)) / 1000
            );
            this.segments[i].build(start, end, arc.isVoid ? ArcRenderer.offsetVoid : ArcRenderer.offsetNormal, arc.time + segSize * i, arc.time + segSize * (i + 1));
        }

        start = end;
        end = new Vector3(
            -ArcAlgorithm.arcXToWorld(arc.end.x),
            ArcAlgorithm.arcYToWorld(arc.end.y),
            -g.getPosByTimingWithStart(arc.time + offset, arc.endTime + offset) / 1000
        );
        if(this.segments.length == 0) {
            console.log(this);
        }
        this.segments[this.segCount - 1].build(start, end, arc.isVoid ? ArcRenderer.offsetVoid : ArcRenderer.offsetNormal, arc.time + segSize * (this.segCount - 1), arc.endTime);

        this.color = arc.isVoid ? ArcRenderer.arcVoid : ArcRenderer.colors[arc.color];
    }

    buildHead() {
        var arc = this.arc;
        var pos = new Vector3(-ArcAlgorithm.arcXToWorld(arc.start.x), ArcAlgorithm.arcYToWorld(arc.start.y));
        var offset = arc.isVoid ? ArcRenderer.offsetVoid : ArcRenderer.offsetNormal;

        var vertices = [];
        var uv = [];

        vertices.push(
            pos.add(new Vector3(0, offset / 2, 0)),
            pos.add(new Vector3(offset, -offset / 2, 0)),
            pos.add(new Vector3(0, -offset / 2, offset / 2)),
            pos.add(new Vector3(-offset, -offset / 2, 0)),
        );

        uv.push(
            new THREE.Vector2(),
            new THREE.Vector2(1, 0),
            new THREE.Vector2(1, 1),
            new THREE.Vector2(1, 1)
        );

        var g = this.headGeometry = new THREE.Geometry();
        g.vertices.push.apply(g.vertices, vertices);
        g.faces.push(
            new THREE.Face3(0, 2, 1),
            new THREE.Face3(0, 3, 2),
            new THREE.Face3(0, 1, 2),
            new THREE.Face3(0, 2, 3)
        );
        g.faceVertexUvs[0].push(
            [uv[0], uv[2], uv[1]],
            [uv[0], uv[3], uv[2]],
            [uv[0], uv[1], uv[2]],
            [uv[0], uv[2], uv[3]]
        );
        g.computeFaceNormals();

        var loader = new THREE.TextureLoader();
        var sTexture = GameplayManager.instance.colorsOnly ? null: loader.load("./assets/textures/ArcBody.png");
        var sMaterial = new THREE.MeshBasicMaterial({
            color: this.color.getHex(),
            opacity: this.arc.isVoid ? 0.4166 : 0.572549,
            transparent: true,
            side: THREE.DoubleSide,
            map: sTexture,
            clippingPlanes: [
                new THREE.Plane( new THREE.Vector3( 0, 0, -1 ), 0)
            ]
        });
        this.head = new THREE.Mesh(g, sMaterial);
    }

    update() {
        this.updateHead();
        this.updateSegments();
        this.updateHeightIndicator();
        this.updateArcCap();

        this.arcCap.visible = this.enableArcCap;
        this.heightIndicator.visible = this.enableArcCap;
    }

    updateSegments() {
        var arc = this.arc;
        var currentTime = GameplayManager.instance.timing;
        var g = arc.timingGroup;
        var offset = GameplayManager.instance.audioManager.offset;
        var z = arc.gameObject.position.z;
        var alpha = arc.isVoid ? 0.4166 : 0.572549;

        for(var i=0; i<this.segments.length; i++) {
            var s = this.segments[i];

            if(-s.toPos.z < z) {
                if(arc.judging || arc.isVoid) {
                    s.enabled = false;
                    continue;
                } else {
                    s.enabled = true;
                    continue;
                }
            }

            if(-s.fromPos.z < z && -s.toPos.z >= z) {
                s.enabled = true;
                s.objects[0].material.opacity = alpha;
                s.objects[1].material.opacity = alpha;

                if(arc.judging || arc.isVoid) {
                    s.from = (z + s.fromPos.z) / (-s.toPos.z + s.fromPos.z);
                } else {
                    s.from = 0;
                }
                continue;
            }

            var pos = -(z + s.fromPos.z);
            if(pos > 90 && pos < 100) {
                s.enabled = true;
                s.from = 0;
                s.objects[0].material.opacity = alpha * (100 - pos) / 10;
                s.objects[1].material.opacity = alpha * (100 - pos) / 10;
            } else if(pos > 100 || pos < -20) {
                s.enabled = false;
            } else {
                s.enabled = true;
                s.objects[0].material.opacity = alpha;
                s.objects[1].material.opacity = alpha;
                s.from = 0;
            }
        }
    }

    updateHead() {
        this.head.visible = this.arc.renderHead;
    }

    updateHeightIndicator() {
        var arc = this.arc;
        if(arc.isVoid || (arc.end.y == arc.start.y)) {
            this.enableHeightIndicator = false;
            return;
        }

        var pos = arc.gameObject.position.z;
        var currentTime = GameplayManager.instance.timing;
        if(pos < -90 && pos > -100) {
            var alpha = arc.isVoid ? 0.4166 : 0.572549;
            this.heightIndicator.material.opacity = alpha * (pos + 100) / 10;
            this.enableHeightIndicator = true;
        } else if(pos < -100 || pos > 10) {
            this.enableHeightIndicator = false;
        } else {
            if(arc.judging && pos > 0) {
                this.enableHeightIndicator = false;
            } else {
                this.enableHeightIndicator = true;
            }
            this.heightIndicator.material.color = this.color;
        }
    }

    updateArcCap() {
        var arc = this.arc;
        var currentTime = GameplayManager.instance.timing;
        var duration = arc.endTime - arc.time;
        var offset = GameplayManager.instance.audioManager.offset;

        if(duration == 0) {
            this.enableArcCap = false;
            return;
        }

        if(arc.position > 0 && arc.position < 100000) {
            if(arc.renderHead && !arc.isVoid) {
                var p = 1 - arc.position / 100000;
                var scale = 0.35 + 0.5 * (1 - p) * (GameplayManager.instance.colorsOnly ? 0.7 : 1);
                this.enableArcCap = true;
                
                var a = this.arcCap;
                a.material.opacity = p;
                a.scale.set(scale, scale, 1);

                a.position.set(-ArcAlgorithm.arcXToWorld(arc.start.x), ArcAlgorithm.arcYToWorld(arc.start.y), -a.parent.position.z + 0.01);
            } else {
                this.enableArcCap = false;
            }
        } else if(arc.position < 0 && arc.endPosition > 0) {
            this.enableArcCap = true;
            
            var a = this.arcCap;
            a.material.opacity = arc.isVoid ? 0.5 : 1;
            var scale = arc.isVoid ? 0.21 : 0.35 * (GameplayManager.instance.colorsOnly ? 0.7 : 1);
            a.scale.set(scale, scale, 1);

            var doBreak = false;
            this.segments.forEach(s => {
                if(doBreak) return;
                if(arc.position / 1000 < s.fromPos.z && arc.position / 1000 >= s.toPos.z) {
                    var t = (s.fromPos.z - arc.position / 1000) / (s.fromPos.z - s.toPos.z);
                    a.position.set(
                        s.fromPos.x + (s.toPos.x - s.fromPos.x) * t,
                        s.fromPos.y + (s.toPos.y - s.fromPos.y) * t,
                        -a.parent.position.z + 0.01
                    );
                    if(!arc.isVoid) {
                        ArcManager.instance.arcJudgePos += a.position.x;
                    }
                    doBreak = true;
                    return;
                }
            });
        } else {
            this.enableArcCap = false;
        }
    }


    /**
     * 
     * @param {number} quantity 
     */
    instantiateSegments(quantity) {
        var count = this.segments.length;
        if(count == quantity) return;

        if(count < quantity) {
            for(var i=0; i<quantity-count; i++) {
                this.segments.push(new ArcSegment());
            }
        } else {
            for(var i=0; i<count-quantity; i++) {
                this.segments.splice(this.segments.length - 1, 1);
            }
        }

        // Unity: SetAsLastSibling();
    }
}

ArcRenderer.offsetNormal = 0.9;
ArcRenderer.offsetVoid = 0.15;

ArcRenderer.arcVoid = new THREE.Color(0.5686275, 0.4705882, 0.6666667); // a = 0.4166f;
ArcRenderer.arcRed = new THREE.Color(1, 0.5882353, 0.8627451); // a = 0.572549f;
ArcRenderer.arcGreen = new THREE.Color(0, 1, 0.4759281); // a = 0.572549f;
ArcRenderer.arcBlue = new THREE.Color(0.04705882, 0.8313726, 0.8313726); // a = 0.572549f;

ArcRenderer.colors = [
    ArcRenderer.arcBlue,
    ArcRenderer.arcRed,
    ArcRenderer.arcGreen
]

class Arc extends ArcaeaJudgableEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time 
     * @param {number} endTime 
     * @param {number} xStart 
     * @param {number} xEnd 
     * @param {ArcLineType} lineType 
     * @param {number} yStart 
     * @param {number} yEnd 
     * @param {ArcLineColor} color 
     * @param {boolean} isVoid 
     */
    constructor(timingGroup, time, endTime, xStart, xEnd, lineType, yStart, yEnd, color, isVoid) {
        super(timingGroup, time);

        this.endTime = endTime;
        this.start = new Vector2(xStart, yStart);
        this.end = new Vector2(xEnd, yEnd);
        this.lineType = lineType;
        this.color = color;
        this.isVoid = isVoid;

        /** @type {ArctapNote[]} */
        this.arcTaps = [];

        /** @type {Arc[]} */
        this.arcGroup = [];

        /** @type {number[]} */
        this.judgeTimings = [];

        this.endPosition = 0;
        this.renderHead = true;
        this.flag = false;
        this.flashCount = 0;
        this.audioPlayed = false;
        this.shouldPlayAudio = false;

        this.arcRenderer = new ArcRenderer(this);
    }

    export(offset = 0) {
        var line = `arc(${this.time + offset},${this.endTime + offset},${Utils.numTo2f(this.start.x)},${Utils.numTo2f(this.end.x)}`
            + `,${this.lineType},${Utils.numTo2f(this.start.y)},${Utils.numTo2f(this.end.y)},${this.color},none,${this.isVoid})`;

        if(this.arcTaps.length == 0) {
            return line + ";";
        }
        return line + "[" + this.arcTaps.map(t => {
            var l = t.export(offset);
            return l.substring(l, l.length - 1);
        }).join(",") + "];";
    }

    canBeRendered() {
        return true;
    }

    /**
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     */
    static fromRaw(line, timingGroup) {
        if(!line.startsWith("arc")) {
            throw new AffFormatError("The given data doesn't represent an arc.");
        }
        var regex = /arc\((\d+?),(\d+?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?)\)(?:\[(.*?)\])?;/;
        var event = line.match(regex);

        var arc = new Arc(
            timingGroup,
            parseInt(event[1]),     // time
            parseInt(event[2]),     // endTime
            parseFloat(event[3]),   // xStart
            parseFloat(event[4]),   // xEnd
            event[5],               // lineType
            parseFloat(event[6]),   // yStart
            parseFloat(event[7]),   // yEnd
            parseInt(event[8]),     // color
            event[10] == "true"     // isVoid
        );

        var arctaps = event[11];
        if(arctaps) {
            var t = arctaps.split(",");
            t.forEach(n => {
                arc.arcTaps.push(new ArctapNote(
                    timingGroup, parseInt(n.substring("arctap(".length, n.length - 1)), arc
                ));
            });
        }

        return arc;
    }

    static newObject() {
        var group = new THREE.Group();
        return group;
    }

    destroy() {
        this.arcRenderer.destroy();
        GameplayManager.instance.game.scene.remove(this.gameObject);

        this.arcTaps.forEach(t => {
            t.destroy();
        });
    }

    calculateJudgeTimings() {
        this.judgeTimings = [];
        if(this.isVoid) return;
        if(this.endTime == this.time) return;

        var u = this.renderHead ? 0 : 1;
        var g = this.timingGroup;
        var bpm = g.getBpmByTiming(this.time);
        if(bpm <= 0) return;

        var interval = 60000 / bpm / (bpm >= 255 ? 1 : 2);
        var total = Math.floor((this.endTime - this.time) / interval);
        if((u ^ 1) >= total) {
            this.judgeTimings.push(Math.floor(this.time + (this.endTime - this.time) * 0.5));
            return;
        }

        var n = u ^ 1;
        while(true) {
            var t = Math.floor(this.time + n * interval);
            if(t < this.endTime) {
                this.judgeTimings.push(t);
            }
            if(total == ++n) break;
        }
    }

    rebuild() {
        this.destroy();
        this.arcRenderer.cleanSegments();
        this.arcRenderer.build();
        this.arcTaps.forEach(t => {
            t.rebuild();
        });
        GameplayManager.instance.game.scene.add(this.gameObject);
    }
}

class TimingEvent extends ArcaeaEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time 
     * @param {number} bpm 
     * @param {number} beatsPerLine 
     */
    constructor(timingGroup, time, bpm, beatsPerLine) {
        super(timingGroup, time);
        this.bpm = bpm;
        this.beatsPerLine = beatsPerLine;
    }

    /**
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     */
    static fromRaw(line, timingGroup) {
        var result = line.match(/timing\((.*?),(.*?),(.*?)\)/);
        return new TimingEvent(timingGroup, parseInt(result[1]), parseFloat(result[2]), parseFloat(result[3]));
    }

    export(offset = 0) {
        return `timing(${this.time + offset},${Utils.numTo2f(this.bpm)},${Utils.numTo2f(this.beatsPerLine)});`;
    }
}

class CameraEvent extends ArcaeaEvent {
    /**
     * @param {TimingGroup} timingGroup
     * @param {number} time 
     * @param {number} tx 
     * @param {number} ty 
     * @param {number} tz 
     * @param {number} rx 
     * @param {number} ry 
     * @param {number} rz 
     * @param {ArcCameraType} type 
     * @param {number} duration 
     */
    constructor(timingGroup, time, tx, ty, tz, rx, ry, rz, type, duration) {
        super(timingGroup, time);

        this.translation = new Vector3(tx, ty, tz);
        this.rotation = new Vector3(rx, ry, rz);
        this.type = type;
        this.duration = duration;

        this.percent = 0;
    }

    /**
     * 
     * @param {number} timing 
     */
    update(timing) {
        if(timing > this.time + this.duration) {
            this.percent = 1;
            return;
        }
        if(timing < this.time) {
            this.percent = 0;
            return;
        }

        this.percent = Utils.clamp((timing - this.time) / this.duration, 0, 1);
        switch(this.type) {
            case "qi":
                this.percent = ArcAlgorithm.qi(this.percent);
                break;
            case "qo":
                this.percent = ArcAlgorithm.qo(this.percent);
                break;
            case "s":
                this.percent = ArcAlgorithm.s(0, 1, this.percent);
                break;
        }
    }

    /**
     * @param {string} line 
     * @param {TimingGroup} timingGroup
     */
    static fromRaw(line, timingGroup) {
        var result = line.match(/camera\((.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?)\)/);
        return new CameraEvent(
            timingGroup,
            parseInt(result[1]),
            parseFloat(result[2]), parseFloat(result[3]), parseFloat(result[4]),
            parseFloat(result[5]), parseFloat(result[6]), parseFloat(result[7]),
            result[8], parseInt(result[9]),
        );
    }

    export(offset = 0) {
        var tx = this.translation.x;
        var ty = this.translation.y;
        var tz = this.translation.z;
        var rx = this.rotation.x;
        var ry = this.rotation.y;
        var rz = this.rotation.z;

        return `camera(${this.time + offset},${tx},${ty},${tz},${rx},${ry},${rz},${this.type},${this.duration});`;
    }
}

class TimingManager {
    constructor() {
        TimingManager.instance = this;
        this.dropRate = 100;

        /** @type {TimingGroup} */
        this.timingGroup = null;

        /** @type {TimingEvent[]} */
        this.timings = [];

        /** @type {TObject3D[]} */
        this.beatlines = [];

        this.beatlineTimings = [];
    }

    clean() {
        this.timingGroup = null;
        this.timings = [];
        this.beatlineTimings = [];
        this.hideExceededBeatlines(0);
    }

    getBeatline(index) {
        while(this.beatlines.length < index + 1) {
            var bGeometry = new THREE.PlaneGeometry();
            var bMaterial = new THREE.MeshBasicMaterial({
                color: 0xaaaaaa
            });
            var line = new THREE.Mesh(bGeometry, bMaterial);
            line.scale.set(17.1, 0.2, 1);
            line.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
            GameplayManager.instance.game.scene.add(line);
            this.beatlines.push(line);
        }
        return this.beatlines[index];
    }

    hideExceededBeatlines(quantity) {
        var count = this.beatlines.length;
        while(count > quantity) {
            this.beatlines[count - 1].visible = false;
            count--;
        }
    }

    /**
     * @param {TimingGroup} timingGroup
     * @param {TimingEvent[]} timings
     */
    load(timingGroup, timings) {
        this.timingGroup = timingGroup;
        this.timings = timings;
        this.calculateBeatlineTimes();
    }

    calculateBeatlineTimes() {
        this.beatlineTimings = [];
        this.hideExceededBeatlines(0);
        var timings = this.timings;

        for(var i=0; i<timings.length-1; ++i) {
            var segment = timings[i].bpm == 0 ? (timings[i+1].time - timings[i].time) : (60000 / Math.abs(timings[i].bpm) * timings[i].beatsPerLine);
            if(segment == 0) continue;

            var n = 0;
            while(true) {
                var j = timings[i].time + (n++) * segment;
                if(j >= timings[i + 1].time) {
                    break;
                }
                this.beatlineTimings.push(j);
            }
        }

        if(timings.length >= 1) {
            var segmentsRemain = timings[timings.length - 1].bpm == 0 ? (GameplayManager.instance.length - timings[timings.length - 1].time)
                : 60000 / Math.abs(timings[timings.length - 1].bpm) * timings[timings.length - 1].beatsPerLine;
            
            if(segmentsRemain != 0) {
                var n = 0;
                var j = timings[timings.length - 1].time;
                while(j < GameplayManager.instance.length) {
                    j = timings[timings.length - 1].time + (n++) * segmentsRemain;
                    this.beatlineTimings.push(j);
                }
            }
        }

        if(timings.length >= 1 && timings[0].bpm != 0 && timings[0].beatsPerLine != 0) {
            var t = 0;
            var delta = 60000 / Math.abs(timings[0].bpm) * timings[0].beatsPerLine;
            var n = 0;
            if(delta != 0) {
                while(t >= -3000) {
                    t = -(++n) * delta;
                    this.beatlineTimings.unshift(t);
                }
            }
        }
    }

    updateBeatline() {
        var index = 0;
        var offset = GameplayManager.instance.audioManager.offset;

        this.beatlineTimings.forEach(t => {
            var z = this.timingGroup.getPosByTiming(Math.floor(t + offset)) / 1000;
            if(z < 0 || z > 100) {
                return;
            }

            var line = this.getBeatline(index);
            line.visible = true;
            line.position.set(0, 0.1, -z);
            line.scale.y = 0.2 + z * 0.01;
            index++;
        });
        this.hideExceededBeatlines(index);
    }

    update() {
        if(this.timingGroup == null) return;
        this.updateBeatline();
    }
}
/** @type {TimingManager} */
TimingManager.instance = null;

class CameraManager {
    constructor(camera) {
        CameraManager.instance = this;
        this.camera = camera;
        this.isReset = true;
        this.currentTilt = 0;
        /** @type {CameraEvent[]} */
        this.cameraEvents = [];

        this.isForce4By3 = false;
    }

    clean() {
        this.cameraEvents = [];
    }

    /**
     * @param {CameraEvent[]} cameras 
     */
    load(cameras) {
        this.cameraEvents.push.apply(this.cameraEvents, cameras);
    }

    resetCamera() {
        var c = this.camera;
        var width = screen.width;
        var height = screen.height;
        var aspect = width / height;

        c.fov = this.is16By9() ? 50 : 65;
        c.near = 1;
        c.far = 10000;

        var resetPos = this.getResetPosition();
        c.position.set(resetPos.x, resetPos.y, resetPos.z)
        c.lookAt(0, -5.5, -20);
        this.isReset = true;
    }

    update() {
        this.updateCameraPos();
        this.updateCameraTilt();
    }

    is16By9() {
        if(this.isForce4By3) return false;
        var canvas = GameplayManager.instance.game.canvas;
        return Math.abs(canvas.width / canvas.height - 16 / 9) < 0.1;
    }

    getResetPosition() {
        return new Vector3(0, 9, this.is16By9() ? 9 : 8);
    }

    getResetRotation() {
        return new Vector3(this.is16By9() ? -26.565 : -27.378, 0, 0);
    }

    updateCameraPos() {
        /** @type {GameplayManager} */
        var gameplayManager = GameplayManager.instance;
        var time = gameplayManager.timing;
        var offset = gameplayManager.audioManager.offset;
        time -= offset;

        for(var i=0; i<this.cameraEvents.length; ++i) {
            var c = this.cameraEvents[i];
            if(c.time > time) break;
            c.update(time);
            if(c.type == "reset") {
                for(var r=0; r<i; ++r) {
                    var cr = this.cameraEvents[r];
                    cr.update(c.time);
                }
            }
        }

        var position = this.getResetPosition();
        var rotation = this.getResetRotation();
        for(var i=0; i<this.cameraEvents.length; ++i) {
            var c = this.cameraEvents[i];
            if(c.time > time) break;

            this.isReset = c.type == "reset";
            if(this.isReset) {
                position = this.getResetPosition();
                rotation = this.getResetRotation();
            }
            
            position.x += c.translation.x * c.percent / 100;
            position.y += c.translation.y * c.percent / 100;
            position.z += c.translation.z * c.percent / 100;

            rotation.x += c.rotation.y * c.percent;
            rotation.y += c.rotation.x * c.percent;
            rotation.z += c.rotation.z * c.percent;
        }

        this.camera.up.set(0, 1, 0);
        this.camera.position.set(position.x, position.y, position.z);

        // The camera is rotating on world axis....
        this.camera.setRotationFromEuler(new THREE.Euler(0, 0, 0));
        this.camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), rotation.x / 180 * Math.PI);
        this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), rotation.y / 180 * Math.PI);
        this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotation.z / 180 * Math.PI);
    }

    updateCameraTilt() {
        if(!this.isReset)  {
            this.currentTilt = 0;
            return;
        }
        var currentArcPos = GameplayManager.instance.autoplay ? -ArcManager.instance.arcJudgePos : 0;
        var pos = Utils.clamp(currentArcPos / 4.25, -1, 1) * 0.05;
        var delta = pos - this.currentTilt;
        var speed = GameplayManager.instance.audioManager.isPlaying ? (currentArcPos == 0 ? 0.02 : 0.04) : 0.03;
        this.currentTilt = this.currentTilt + speed * delta;
        this.camera.up.set(this.currentTilt, 1 - this.currentTilt, 0);
        this.camera.lookAt(new THREE.Vector3(0, -5.5, -20)); 
    }
}
/** @type {CameraManager} */
CameraManager.instance = null;

class AudioManagerBase {
    constructor() {
        this.offset = 0;
        this.timing = 0;
        this.speed = 1;
        this.isPlaying = false;
        this.volume = 0.3;
        this.loop = false;

        Object.defineProperty(this, "semitoneOffset", {
            get: () => {
                return Math.log(this.speed) / Math.log(2) * 12;
            },
            set: (v) => {
                this.setPlaybackRate(Math.pow(2, v / 12));
            }
        });
    }

    /**
     * @param {string} url
     * @param {number} offset 
     */
    async load(url, offset) {
        throw new Error("This method was not implemented.");
    }

    play() {
        throw new Error("This method was not implemented.");
    }

    setPlaybackRate(speed) {
        throw new Error("This method was not implemented.");
    }

    pause() {
        throw new Error("This method was not implemented.");
    }

    stop() {
        throw new Error("This method was not implemented.");
    }

    setTime(time) {
        throw new Error("This method was not implemented.");
    }

    update() {
        throw new Error("This method was not implemented.");
    }

    length() {
        throw new Error("This method was not implemented.");
    }
}

class LegacyAudioManager extends AudioManagerBase {
    /**
     * @param {HTMLAudioElement} audioElem 
     */
    constructor(audioElem) {
        super();
        this.audioElem = audioElem || document.createElement("audio");

        Object.defineProperty(this, "isPlaying", {
            get: () => {
                return !this.audioElem.paused;
            }
        });
        
        Object.defineProperty(this, "volume", {
            get: () => {
                return this.audioElem.volume;
            },
            set: (v) => {
                this.audioElem.volume = v;
            }
        });

        Object.defineProperty(this, "loop", {
            get: () => {
                return this.audioElem.loop;
            },
            set: (v) => {
                this.audioElem.loop = v;
            }
        });
    }

    length() {
        return this.audioElem.duration;
    }

    /**
     * @param {string} url The path to the audio file.
     * @param {number} offset Audio offset in milliseconds.
     */
    load(url, offset) {
        this.offset = offset;
        return new Promise((resolve, reject) => {
            this.audioElem.src = url;
            this.audioElem.addEventListener("loadeddata", e => {
                resolve();
            });
        })
    }

    play() {
        this.audioElem.play();
    }

    setPlaybackRate(speed) {
        this.speed = speed;
        this.audioElem.playbackRate = speed;
    }

    pause() {
        this.audioElem.pause();
    }

    stop() {
        this.audioElem.stop();
    }

    setTime(time) {
        this.audioElem.currentTime = time;
    }

    update() {
        this.timing = Utils.lerp(this.timing, this.audioElem.currentTime, this.isPlaying ? 1 : GameplayManager.instance.deltaTime / 120);
    }
}

class AudioManager extends AudioManagerBase {
    /**
     * @param {HTMLAudioElement} audioElem 
     */
    constructor(audioElem) {
        super();
        var ctx = this.context = new AudioContext();
        
        this.audioElem = audioElem;
        var en = ctx.createMediaElementSource(audioElem);
        var eg = ctx.createGain();
        eg.gain.value = 0;
        en.connect(eg).connect(ctx.destination);

        audioElem.addEventListener("play", e => {
            if(!this.audioSource) {
                audioElem.pause();
                return;
            }
            this.play();
        });

        audioElem.addEventListener("pause", e => {
            if(!this.audioSource) {
                return;
            }
            this.pause();
        });

        /** @type {AudioBufferSourceNode} */
        this.audioSource = null;

        var gain = this.gainNode = ctx.createGain();
        gain.gain.value = 1;
        gain.connect(ctx.destination);

        Object.defineProperty(this, "volume", {
            get: () => {
                return gain.gain.value;
            },
            set: (v) => {
                gain.gain.value = v;
            }
        });

        Object.defineProperty(this, "loop", {
            get: () => {
                return this.audioElem.loop;
            },
            set: (v) => {
                this.audioSource.loop = v;
                this.audioElem.loop = v;
            }
        });
    }

    length() {
        if(!this.audioSource) return 0;
        var b = this.audioSource.buffer;
        return b.length / b.sampleRate;
    }

    /**
     * 
     * @param {ArrayBuffer} buffer 
     */
    async decode(buffer) {
        var b = await this.context.decodeAudioData(buffer);
        return b;
    }

    /**
     * 
     * @param {string} url
     * @param {number} offset 
     */
    async load(url, offset) {
        this.stop();
        if(this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource.buffer = null;
        }
        this.audioSource = null;

        this.audioElem.src = url;
        var buf = await (await fetch(url)).arrayBuffer();
        this.loadBuffer(await this.decode(buf), offset);
    }

    /**
     * 
     * @param {AudioBuffer} buffer 
     * @param {number} offset 
     */
    loadBuffer(buffer, offset) {
        this.offset = offset;
        var src = this.context.createBufferSource();
        src.buffer = buffer;
        src.loop = this.loop;
        src.connect(this.gainNode);

        if(this.audioSource && this.isPlaying) this.audioSource.stop();
        this.isPlaying = false;
        this.audioSource = src;
    }

    play() {
        if(!this.audioSource) return;

        if(this.timing >= this.length()) {
            this.setTime(0);
        }

        if(this.audioElem.paused) {
            this.audioElem.play()
        }
        this.timing = this.audioElem.currentTime;
        this.audioSource.playbackRate.value = this.speed;
        this.audioSource.start(0, this.timing);
        this.isPlaying = true;
    }

    setPlaybackRate(speed) {
        this.speed = speed;
        this.audioElem.playbackRate = speed;
        if(this.isPlaying) {
            this.audioSource.playbackRate.value = speed;
        }
    }

    pause() {
        if(!this.audioElem.paused) {
            this.audioElem.pause()
        }

        if(this.audioSource) {
            try {
                this.audioSource.stop();
            } catch(ex) { }
            this.isPlaying = false;
            this.loadBuffer(this.audioSource.buffer, this.offset);
        } else {
            this.isPlaying = false;
        }
    }

    stop() {
        this.pause();
        this.timing = 0;
    }

    setTime(time) {
        var playing = this.isPlaying;
        if(playing) {
            this.pause();
        }
        this.timing = time;
        this.audioElem.currentTime = time;

        if(playing) {
            this.play();
        }
    }

    update() {
        if(this.audioSource) {
            this.audioSource.loop = this.loop;
        }

        if(this.isPlaying) {
            this.timing += GameplayManager.instance.deltaTime / 1000 * this.speed;
            
            if(this.timing >= this.length()) {
                if(this.loop) {
                    this.timing -= this.length();
                } else {
                    this.isPlaying = false;
                }
            }
        } else {
            this.timing = Utils.lerp(this.timing, this.audioElem.currentTime, GameplayManager.instance.deltaTime / 120);
        }
    }
}

class GameplayManager {
    /**
     * @param {GameBase} game 
     */
    constructor(game) {
        GameplayManager.instance = this;
        this.game = game;

        /** @type {AudioManagerBase} */
        var conditions = location.protocol == "file:" || !window.AudioContext;
        var elem = document.getElementById("game-audio");
        this.audioManager = conditions ? new LegacyAudioManager(elem) : new AudioManager(elem);
        this.audioManager.volume = 0.3;

        this.colorsOnly = location.protocol == "file:";

        this.lastUpdate = 0;
        this.deltaTime = 0;

        this.difficulties = [
            "Past", "Present", "Future", "Beyond"
        ];

        this.autoplay = true;
        
        Object.defineProperty(this, "timing", {
            get: () => {
                return Math.floor(this.audioManager.timing * 1000);
            },
            set: (value) => {
                var v = value / 1000;
                this.audioManager.setTime(v);
            }
        });

        Object.defineProperty(this, "isPlaying", {
            get: () => {
                return this.audioManager.isPlaying;
            }
        });

        Object.defineProperty(this, "length", {
            get: () => {
                return Math.floor(this.audioManager.length() * 1000);
            }
        });
    }

    update() {
        var now = performance.now();
        this.deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        this.audioManager.update();
    }
}

/** @type {GameplayManager} */
GameplayManager.instance = null;

class TapNoteManager {
    constructor() {
        TapNoteManager.instance = this;

        /** @type {TapNote[]} */
        this.taps = [];
        this.lanes = [
            -ArcAlgorithm.arcXToWorld(-0.25),
            -ArcAlgorithm.arcXToWorld(0.25),
            -ArcAlgorithm.arcXToWorld(0.75),
            -ArcAlgorithm.arcXToWorld(1.25),
        ];
    }

    clean() {
        this.taps.forEach(t => {
            t.destroy();
        });
        this.taps = [];
    }

    /**
     * 
     * @param {TapNote[]} taps 
     */
    load(taps) {
        this.taps = taps;
        taps.forEach(t => {
            t.gameObject = TapNote.newObject();
            GameplayManager.instance.game.scene.add(t.gameObject);
        });
    }

    /**
     * 
     * @param {TapNote} tap 
     */
    add(tap) {
        this.taps.push(tap);
        tap.setupArcTapConnection();
    }

    /**
     * 
     * @param {TapNote} tap 
     */
    remove(tap) {
        var i = this.taps.indexOf(tap);
        tap.destroy();
        this.taps.splice(i, 1);
    }

    update() {
        if(this.taps.length == 0) return;
        if(GameplayManager.instance.autoplay) this.judgeTapNotes();
        this.renderTapNotes();
    }

    judgeTapNotes() {
        var offset = GameplayManager.instance.audioManager.offset;
        var time = GameplayManager.instance.timing;

        this.taps.forEach(t => {
            if(t.judged && time > t.time + offset + 150) return;
            if(time < t.time + offset) {
                t.judged = false;
            }

            if(time > t.time + offset && time <= t.time + offset + 150) {
                t.judged = true;
            } else if(time > t.time + offset + 150) {
                t.judged = true;
            }
        });
    }

    renderTapNotes() {
        var offset = GameplayManager.instance.audioManager.offset;

        this.taps.forEach(t => {
            var g = t.timingGroup;
            if(!g.shouldRender(t.time + offset) || t.judged) {
                t.enabled = false;
                t.gameObject.visible = false;
                return;
            }

            t.position = g.getPosByTiming(t.time + offset);
            if(t.position > 100000 || t.position < -10000) {
                t.enabled = false;
                t.gameObject.visible = false;
                return;
            }

            t.enabled = true;
            t.gameObject.visible = true;
            var pos = t.position / 1000;
            t.gameObject.position.set(this.lanes[t.lane - 1], 0.11, -pos - 1.15);
            t.gameObject.material.opacity = pos < 90 ? 1 : (100 - pos) / 10;
        });
    }
}
/** @type {TapNoteManager} */
TapNoteManager.instance = null;

class ArcManager {
    constructor() {
        ArcManager.instance = this;

        /** @type {Arc[]} */
        this.arcs = [];
        this.arcJudgePos = 0;
    }

    clean() {
        this.arcs.forEach(a => {
            a.destroy();
            a = null;
        });
        this.arcs = [];
    }

    /**
     * @param {Arc[]} arcs
     */
    load(arcs) {
        this.arcs = arcs;
        arcs.forEach(a => {
            var renderer = a.arcRenderer;
            renderer.build();
            GameplayManager.instance.game.scene.add(a.gameObject);

            a.arcTaps.forEach(t => {
                t.gameObject = ArctapNote.newObject();
                t.shadow = ArctapNote.newShadow();
                GameplayManager.instance.game.scene.add(t.gameObject);
                GameplayManager.instance.game.scene.add(t.shadow);

                t.setupArcTapConnection();
            });
        });
        this.calculateArcRelationship();
    }

    calculateArcRelationship() {
        this.arcs.forEach(a => {
            a.arcGroup = null;
            a.renderHead = true;
        });

        this.arcs.forEach(a => {
            this.arcs.forEach(b => {
                if(a == b) return;
                if(Math.abs(a.end.x - b.start.x) < 0.1 && Math.abs(a.endTime - b.time) <= 9 && a.end.y == b.start.y) {
                    if(a.color == b.color && a.isVoid == b.isVoid && a.timingGroup == b.timingGroup) {
                        if(a.arcGroup == null && b.arcGroup != null) {
                            a.arcGroup = b.arcGroup;
                        } else if(a.arcGroup != null && b.arcGroup == null) {
                            b.arcGroup = a.arcGroup;
                        } else if(a.arcGroup != null && b.arcGroup != null) {
                            b.arcGroup.forEach(t => {
                                if(a.arcGroup.indexOf(t) == -1) {
                                    a.arcGroup.push(t);
                                }
                            });
                            b.arcGroup = a.arcGroup;
                        } else if(a.arcGroup == null && b.arcGroup == null) {
                            a.arcGroup = b.arcGroup = [a];
                        }

                        if(a.arcGroup.indexOf(b) == -1) {
                            a.arcGroup.push(b);
                        }
                    }

                    if(a.isVoid == b.isVoid) {
                        b.renderHead = false;
                    }
                }
            });
        });

        this.arcs.forEach(a => {
            if(a.arcGroup == null) {
                a.arcGroup = [a];
            }
            a.arcGroup.sort((a, b) => {
                return a.time - b.time;
            });
        });

        this.arcs.forEach(a => {
            a.calculateJudgeTimings();
        });
    }

    update() {
        if(this.arcs.length == 0) return;
        if(GameplayManager.instance.autoplay) {
            this.judgeArcs();
        }
        this.arcJudgePos = 0;
        this.renderArcs();
    }

    judgeArcs() {
        var time = GameplayManager.instance.timing;
        var offset = GameplayManager.instance.audioManager.offset;
        this.arcs.forEach(a => {
            this.judgeArcTaps(a);
            if(time < a.time + offset) {
                a.judged = false;
                a.judging = false;
            }

            if(a.judged && time > a.endTime + offset) return;

            if(time > a.endTime + offset) {
                a.judged = true;
            } else if(time > a.time + offset && time <= a.endTime + offset) {
                if(!a.isVoid) {
                    if(!a.audioPlayed) {
                        if(GameplayManager.instance.isPlaying) {
                            // console.log("Play arc sound");
                        }
                        a.audioPlayed = true;
                    }
                }
                a.arcGroup.forEach(b => {
                    b.judging = true;
                });
            } else {
                a.shouldPlayAudio = true;
            }
        });
    }

    /**
     * 
     * @param {Arc} arc 
     */
    judgeArcTaps(arc) {
        var time = GameplayManager.instance.timing;
        var offset = GameplayManager.instance.audioManager.offset;
        arc.arcTaps.forEach(t => {
            if(time < t.time + offset) {
                t.judged = false;
            }
            if(t.judged) return;
            if(time > t.time + offset && time <= t.time + offset + 150) {
                t.judged = true;
                if(GameplayManager.instance.isPlaying) {
                    // console.log("Play arctap sound");
                }
            } else if(t > t.time + offset + 150) {
                t.judged = true;
            }
        });
    }

    renderArcs() {
        var time = GameplayManager.instance.timing;
        var offset = GameplayManager.instance.audioManager.offset;

        this.arcs.forEach(t => {
            this.renderArcTaps(t);
            var g = t.timingGroup;
            var duration = t.endTime - t.time;

            if(!g.shouldRender(t.time + offset, duration + (t.isVoid ? 50 : 120)) || t.judged) {
                t.enabled = false;
                t.gameObject.visible = false;
                return;
            }

            t.position = g.getPosByTiming(t.time + offset);
            t.endPosition = g.getPosByTiming(t.endTime + offset);
            if(t.position > 100000 || t.endPosition < -20000) {
                t.enabled = false;
                t.gameObject.visible = false;
                return;
            }

            t.enabled = true;
            t.gameObject.visible = true;
            t.gameObject.position.set(0, 0, -t.position / 1000);
            t.arcRenderer.heightIndicator.visible = t.arcRenderer.head.visible;

            if(!t.isVoid) {
                t.arcRenderer.enableEffect = time > t.time + offset && time < t.endTime + offset && !t.isVoid && t.judging;
                t.arcGroup.forEach(a => {
                    if(!a.flag) {
                        a.flag = true;
                        var alpha = 1;
                        if(a.judging) {
                            a.flashCount = (a.flashCount + 1) % 5;
                            if(a.flashCount == 0) {
                                alpha = 0.85;
                            }
                            a.arcRenderer.highlight = true;
                        } else {
                            alpha = 0.65;
                            a.arcRenderer.highlight = false;
                        }

                        alpha *= 0.8823592;
                        a.gameObject.children.forEach(gg => {
                            gg.children.forEach(m => {
                                m.material.opacity = alpha;
                            });
                        });
                    }
                });
            } else {
                t.arcRenderer.enableEffect = false;
                t.arcRenderer.highlight = false;

                t.gameObject.children.forEach(gg => {
                    gg.children.forEach(m => {
                        m.material.opacity = 0.318627;
                    });
                });
            }

            t.arcRenderer.update();
        });

        this.arcs.forEach(t => {
            t.flag = false;
        });
    }

    /**
     * 
     * @param {Arc} arc 
     */
    renderArcTaps(arc) {
        var time = GameplayManager.instance.timing;
        var g = arc.timingGroup;
        var offset = GameplayManager.instance.audioManager.offset;

        arc.arcTaps.forEach(t => {
            if(!g.shouldRender(t.time + offset, 50) || t.judged) {
                t.enabled = false;
                t.gameObject.visible = false;
                t.shadow.visible = false;
                t.connections.forEach(c => {
                    c.line.visible = false;
                });
                return;
            }

            if(time > t.time + offset + 50) {
                t.enabled = false;
                t.gameObject.visible = false;
                t.shadow.visible = false;
                t.connections.forEach(c => {
                    c.line.visible = false;
                });
                return;
            }

            var pos = g.getPosByTiming(t.time + offset) / 1000;
            t.gameObject.position.set(
                -ArcAlgorithm.arcXToWorld(ArcAlgorithm.resolveX(arc.start.x, arc.end.x, (t.time - arc.time) / (arc.endTime - arc.time), arc.lineType)), 
                ArcAlgorithm.arcYToWorld(ArcAlgorithm.resolveY(arc.start.y, arc.end.y, (t.time - arc.time) / (arc.endTime - arc.time), arc.lineType)) - 0.5,
                -pos - 0.38
            );

            t.shadow.position.set(
                -ArcAlgorithm.arcXToWorld(ArcAlgorithm.resolveX(arc.start.x, arc.end.x, (t.time - arc.time) / (arc.endTime - arc.time), arc.lineType)), 
                0.11,
                -pos - 0.38
            );

            t.connections.forEach(c => {
                c.line.position.z = -pos - 0.38;
            });

            if(pos > -10 && pos <= 90) {
                t.gameObject.material.opacity = 1;
                t.enabled = true;
                t.gameObject.visible = true;
                t.shadow.visible = true;
                t.connections.forEach(c => {
                    c.line.visible = true;
                    c.line.material.opacity = 1;
                });
            } else if(pos > 90 && pos <= 100) {
                t.enabled = true;
                t.gameObject.visible = true;
                t.gameObject.material.opacity = (100 - pos) / 10;
                t.shadow.visible = true;
                t.connections.forEach(c => {
                    c.line.visible = true;
                    c.line.material.opacity = (100 - pos) / 10;
                });
                t.shadow.material.opacity = (100 - pos) / 10;
            } else {
                t.enabled = false;
                t.gameObject.visible = false;
                t.shadow.visible = false;
                t.connections.forEach(c => {
                    c.line.visible = false;
                });
            }
        });
    }

    rebuild() {
        this.arcs.forEach(a => a.rebuild());
        this.calculateArcRelationship();
    }
}
/** @type {ArcManager} */
ArcManager.instance = null;

class HoldManager {
    constructor() {
        HoldManager.instance = this;

        /** @type {HoldNote[]} */
        this.holds = [];
        this.lanes = [
            -ArcAlgorithm.arcXToWorld(-0.25),
            -ArcAlgorithm.arcXToWorld(0.25),
            -ArcAlgorithm.arcXToWorld(0.75),
            -ArcAlgorithm.arcXToWorld(1.25),
        ];
    }

    clean() {
        this.holds.forEach(h => {
            h.destroy();
        });
        this.holds = [];
    }

    /**
     * @param {HoldNote[]} holds
     */
    load(holds) {
        this.holds = holds;
        holds.forEach(h => {
            h.gameObject = HoldNote.newObject();
            GameplayManager.instance.game.scene.add(h.gameObject);
        });
    }

    /** 
     * @param {HoldNote} hold
     */
    add(hold) {
        hold.gameObject = HoldNote.newObject();
        GameplayManager.instance.game.scene.add(hold.gameObject);
        this.holds.push(hold);
    }

    remove(hold) {
        hold.destroy();
        var i = this.holds.indexOf(hold);
        if(i != -1) this.holds.splice(i, 1);
    }

    update() {
        if(this.holds.length == 0) return;
        if(GameplayManager.instance.autoplay) this.judgeHoldNotes();
        this.renderHoldNotes();
    }

    judgeHoldNotes() {
        var offset = GameplayManager.instance.audioManager.offset;
        var time = GameplayManager.instance.timing;

        this.holds.forEach(t => {
            if(time < t.time + offset) {
                t.judged = false;
                t.judging = false;
            }

            if(t.judged) return;
            if(time >= t.time + offset && time <= t.endTime + offset) {
                t.judging = true;
                if(!t.audioPlayed) {
                    if(GameplayManager.instance.audioManager.isPlaying && t.shouldPlayAudio) {
                        // TODO: play tap sound
                        t.audioPlayed = true;
                    }
                    // TODO: effect
                }
            } else if(time > t.endTime + offset) {
                t.judging = false;
                t.judged = true;
                t.audioPlayed = true;
                // TODO: deactivate effect
            } else {
                t.shouldPlayAudio = true;
            }
        });
    }

    renderHoldNotes() {
        var offset = GameplayManager.instance.audioManager.offset;
        
        this.holds.forEach(t => {
            var g = t.timingGroup;
            var duration = t.endTime - t.time;
            if(!g.shouldRender(t.time + offset, duration + 120) || t.judged) {
                t.gameObject.visible = false;
                t.enabled = false;
                return;
            }

            t.position = g.getPosByTiming(t.time + offset);
            var endPosition = g.getPosByTiming(t.endTime + offset);
            if(t.position > 100000 || endPosition < -10000) {
                t.gameObject.visible = false;
                t.enabled = false;
                return;
            }

            t.gameObject.visible = true;
            t.enabled = true;
            var pos = t.position / 1000;
            var length = (endPosition - t.position) / 1000;

            t.gameObject.position.set(this.lanes[t.lane - 1], 0.11, -pos - length / 2);
            t.gameObject.scale.set(4.2746 * 0.95, length, 1 * 0.95);

            t.gameObject.material.opacity = pos < 90 ? 1 : (100 - pos) / 10;
        });
    }
}
/** @type {HoldManager} */
HoldManager.instance = null;

class GameBase {
    /** 
     * @param {HTMLCanvasElement | null}
     */
    constructor(canvas) {
        this.scene = new THREE.Scene();
        this.backScene = new THREE.Scene();

        var width = Math.max(screen.width, screen.height) * devicePixelRatio;
        var height = Math.min(screen.width, screen.height) * devicePixelRatio;
        var aspect = width / height;

        this.camera = new THREE.PerspectiveCamera(50, aspect, 1, 10000);
        this.backCamera = new THREE.OrthographicCamera(1920 / -2, 1920 / 2, 1080 / 2, 1080 / -2, 0, 100);
        this.gameplayManager = new GameplayManager(this);
        this.setupScene();

        var renderer = this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true
        });
        renderer.localClippingEnabled = true;
        renderer.setSize(width, height, false);
        
        /** @type {HTMLCanvasElement} */
        this.canvas = renderer.domElement;
        this.canvas.id = "main";
        if(canvas == null) {
            document.getElementById("canvas-wrapper").appendChild(this.canvas);
        }

        /** @type {Chart} */
        this.chart = null;

        this.timingManager = new TimingManager();
        this.cameraManager = new CameraManager(this.camera);

        this.tapNoteManager = new TapNoteManager();
        this.arcManager = new ArcManager();
        this.holdManager = new HoldManager();

        this.albumSrc = "./assets/charts/a0/base.jpg";
        this.songName = "--";
        this.artistName = "";
        this.difficultyType = 2;
        this.difficultyLvl = "7";

        this.update();
    }

    makeMeCute() {
        this.gameplayManager.audioManager.setPlaybackRate(1.15);
        this.timingManager.dropRate /= 1.15;
        this.arcManager.rebuild();
    }

    setupScene() {
        this.setupCamera();
        this.setupBackground();
        this.setupTrack();
    }

    setupCamera() {
        var camera = this.camera;
        var backCamera = this.backCamera;

        var width = screen.width;
        var height = screen.height;
        var aspect = width / height;

        camera.position.set(0, 9, Math.abs(aspect - 16 / 9) < 0.1 ? 9 : 8);
        camera.lookAt(0, -5.5, -20);

        backCamera.position.set(0, 0, 0);
        backCamera.lookAt(0, 0, -1);
    }

    setupBackground() {
        var plane = new THREE.PlaneGeometry(1920, 1080);
        var loader = new THREE.TextureLoader();
        var bg = GameplayManager.instance.colorsOnly ? null: loader.load("./assets/textures/Axiumcrisis.jpg");
        var material = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0x171433 : 0xffffff,
            map: bg
        });
        var obj = new THREE.Mesh(plane, material);
        obj.position.z = -99.9;
        this.backScene.add(obj);
    }

    setupTrack() {
        var plane = new THREE.PlaneGeometry();
        var box = new THREE.BoxGeometry();
        var loader = new THREE.TextureLoader();

        var trackMaterial = null;
        if(GameplayManager.instance.colorsOnly) {
            trackMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff
            });
        } else {
            var trackTexture = loader.load("./assets/textures/TrackWhite.png");
            trackTexture.wrapT = THREE.RepeatWrapping;
            trackTexture.repeat.set(1, 55);
            setInterval(() => {
                var speed = 1;
                if(this.chart) {
                    var g = this.chart.timingGroups[0];
                    speed = g.getBpmByTiming(this.gameplayManager.timing - this.gameplayManager.audioManager.offset) / g.getBaseBpm();
                }
                var y = trackTexture.offset.y;
                y += (this.gameplayManager.deltaTime * this.timingManager.dropRate / 12 * speed) / 1000;
                y = y % 1;
                trackTexture.offset.set(0, y);
            }, 10);
            trackMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                map: trackTexture
            });
        }

        var cube = new THREE.Mesh(box, trackMaterial);
        cube.position.x = 0;
        cube.position.y = 0;
        cube.position.z = -25.5;
        cube.scale.x = 10.24 * 1.78965;
        cube.scale.y = 0.1;
        cube.scale.z = 153.5;
        cube.renderOrder = -9999;
        this.scene.add( cube );

        // Sky Input
        var skTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/SkyInputLine.png");
        var skLabelTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/SkyInputLabel.png");
        var skMaterial = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0xff5555 : 0xffffff,
            map: skTexture,
            transparent: true,
            opacity: GameplayManager.instance.colorsOnly ? 0.5 : 1,
            side: THREE.DoubleSide
        });
        var skLabelMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: skLabelTexture,
            transparent: true,
            opacity: GameplayManager.instance.colorsOnly ? 0 : 1,
            side: THREE.DoubleSide
        });

        var dTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/TrackLaneDivider.png");
        var dMaterial = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0 : 0xffffff,
            map: dTexture,
            transparent: true,
            opacity: GameplayManager.instance.colorsOnly ? 0.1 : 1
        });

        // 3 division lines.
        for(var i=0; i<3; i++) {
            var dLine = new THREE.Mesh(plane, dMaterial);
            dLine.position.set(-ArcAlgorithm.arcXToWorld(i * 0.5), 0.0505, -75.5 / 2 + 0.5);
            dLine.scale.x = 0.1;
            dLine.scale.y = 75.5;
            dLine.scale.z = 1;
            dLine.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
            dLine.renderOrder = -500;
            this.scene.add(dLine);

            
            var dLineR = new THREE.Mesh(plane, dMaterial);
            dLineR.position.set(-ArcAlgorithm.arcXToWorld(i * 0.5), 0.0505, 10.5 / 2);
            dLineR.scale.x = 0.1;
            dLineR.scale.y = -10.5;
            dLineR.scale.z = 1;
            dLineR.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
            dLineR.renderOrder = -500;
            this.scene.add(dLineR);
        }

        var clTexture = GameplayManager.instance.colorsOnly ? null : loader.load("./assets/textures/TrackCriticalLine.png");
        var clMaterial = new THREE.MeshBasicMaterial({
            color: GameplayManager.instance.colorsOnly ? 0x4f4463 : 0xffffff,
            map: clTexture,
            transparent: true
        });

        var criticalLine = new THREE.Mesh(plane, clMaterial );
        criticalLine.position.set(0, 0.051, GameplayManager.instance.colorsOnly ? 0.15 : 0);
        criticalLine.scale.x = 17.1;
        criticalLine.scale.y = GameplayManager.instance.colorsOnly ? 0.4 : 1;
        criticalLine.scale.z = 1;
        criticalLine.setRotationFromEuler(new THREE.Euler(-90 / 180 * Math.PI, 0, 0));
        criticalLine.renderOrder = -300;
        this.scene.add( criticalLine );

        var skLine = new THREE.Mesh(plane, skMaterial);
        skLine.position.y = 5.5;
        skLine.scale.x = 1920;
        skLine.scale.y = GameplayManager.instance.colorsOnly ? 0.1 : 0.25;
        skLine.renderOrder = 9999;
        this.scene.add(skLine);

        var skLabel = new THREE.Mesh(plane, skLabelMaterial);
        skLabel.position.x = 7.1;
        skLabel.position.y = 5.6;
        skLabel.position.z = 0.01;
        skLabel.scale.x = 130 / 130;
        skLabel.scale.y = 39 / 130;
        skLabel.renderOrder = 10000;
        this.scene.add(skLabel);
    }

    clean() {
        TimingManager.instance.clean();
        TapNoteManager.instance.clean();
        ArcManager.instance.clean();
        HoldManager.instance.clean();
        CameraManager.instance.clean();
    }

    /**
     * 
     * @param {Chart} chart 
     * @param {string} audio 
     */
    load(chart, audio) {
        this.clean();
        this.chart = chart;

        var tg = chart.getPrimaryTimingGroup();
        this.gameplayManager.audioManager.load(audio, chart.offset).then(() => {
            this.timingManager.load(tg, tg.getTimingEvents());
            this.tapNoteManager.load(chart.taps());
            this.arcManager.load(chart.arcs());
            this.holdManager.load(chart.holds());
            this.cameraManager.load(chart.cameras());
        });
    }

    countCombo() {
        var offset = this.gameplayManager.audioManager.offset;
        var time = this.gameplayManager.timing - offset;

        var count = 0;
        count += this.tapNoteManager.taps.filter(t => t.time < time).length;
        this.holdManager.holds.forEach(h => {
            count += h.judgeTimings.filter(t => t <= time).length;
            if(h.time < time) {
                count++;
            }
        });
        
        this.arcManager.arcs.forEach(a => {
            if(a.isVoid) {
                count += a.arcTaps.filter(t => t.time < time).length;
            } else {
                count += a.judgeTimings.filter(t => t <= time).length;
            }
        });
        return count;
    }

    countTotal() {
        var count = 0;
        count += this.tapNoteManager.taps.length;
        this.holdManager.holds.forEach(h => {
            count += h.judgeTimings.length + 1;
        });
        
        this.arcManager.arcs.forEach(a => {
            if(a.isVoid) {
                count += a.arcTaps.length;
            } else {
                count += a.judgeTimings.length;
            }
        });
        return count;
    }

    countScore() {
        var total = this.countTotal() || 1;
        var combo = this.countCombo();
        var score = Math.floor(10000000 * combo / total) + combo;

        return [score, combo, total];
    }

    update() {
        window.requestAnimationFrame(() => {
            this.update();
        });
        
        var width = Math.max(screen.width, screen.height) * devicePixelRatio;
        var height = Math.min(screen.width, screen.height) * devicePixelRatio;
        var aspect = width / height;

        this.camera.aspect = aspect;
        this.camera.setViewOffset(width, height, 0, 0, width, height);
        this.camera.updateProjectionMatrix();
        this.backCamera.setViewOffset(width, height, 0, 0, width, height);
        this.backCamera.updateProjectionMatrix();

        // Managers update
        this.gameplayManager.update();
        
        if(this.chart) {
            this.chart.timingGroups.forEach(t => {
                t.updateRenderRange();
            });
        }
        
        this.timingManager.update();
        this.tapNoteManager.update();
        this.arcManager.update();
        this.holdManager.update();
        this.cameraManager.update();

        var comboText = document.getElementById("combo");
        var scoreText = document.getElementById("score");
        var [score, combo, total] = this.countScore();

        var oldScore = parseInt(scoreText.innerText);
        if(GameplayManager.instance.audioManager.isPlaying) {
            score = oldScore < score ? Math.round(Math.min(oldScore + (9 *  total) / GameplayManager.instance.deltaTime, score)) : score;
        }

        comboText.innerText = combo >= 2 ? combo : "";

        var scoreStr = "";
        for(var i=7; i>Math.log10(score || 1); i--) {
            scoreStr += "0";
        }
        scoreStr += score;
        scoreText.innerText = scoreStr;

        // Chart info
        var diffMeta = document.getElementById("diff-meta");
        diffMeta.className = "diff-" + this.difficultyType;
        var diffTxt = document.getElementById("diff");
        diffTxt.innerText = this.gameplayManager.difficulties[this.difficultyType] + " " + this.difficultyLvl;
        var nameTxt = document.getElementById("name");
        var artistTxt = document.getElementById("artist");
        nameTxt.innerText = this.songName;
        artistTxt.innerText = this.artistName;
        var albumImg = document.getElementById("album");
        albumImg.src = this.albumSrc;
        var prog = document.getElementById("track-prog");
        prog.value = GameplayManager.instance.audioManager.timing / (GameplayManager.instance.audioManager.length() || 1) * 100;

        if(window.innerHeight > window.innerWidth) {
            document.getElementById("game-wrapper").classList.remove("fullscreen");
        }

        this.renderer.setSize(width, height, false);
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.backScene, this.backCamera);
        this.renderer.render(this.scene, this.camera);
    }
}