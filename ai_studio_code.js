'use strict';

// 1. DB Logic (IndexedDB)
const DB = {
    get: (k) => Promise.resolve(JSON.parse(localStorage.getItem('sr_' + k))),
    set: (k, v) => Promise.resolve(localStorage.setItem('sr_' + k, JSON.stringify(v))),
    del: (k) => Promise.resolve(localStorage.removeItem('sr_' + k))
};

// 2. Default Config
const DEFAULT_CONFIG = {
    versionId: '2025_v1',
    adminPassword: 'admin',
    eventTitle: '文化祭\nスタンプラリー',
    eventYear: '2025',
    stamps: [
        { id:'s1', name:'科学室', location:'3F 理科室', emoji:'🔬', code:'1111', barcodeId:0 },
        { id:'s2', name:'美術部', location:'2F 美術室', emoji:'🎨', code:'2222', barcodeId:1 }
    ],
    ui: { btnScan: 'ARスキャン開始', mapTitle: 'スタンプマップ' },
    coupon: { title: '特典クーポン', code: 'FINISH-2025' }
};

// 3. State Management
let State = {
    acq: [],
    start: null,
    done: false,
    async load() {
        this.acq = await DB.get('acq') || [];
        this.start = await DB.get('start');
        this.done = await DB.get('done') || false;
    },
    async addStamp(id) {
        if (!this.acq.includes(id)) {
            this.acq.push(id);
            await DB.set('acq', this.acq);
            return true;
        }
        return false;
    },
    async reset() {
        await DB.del('acq'); await DB.del('start'); await DB.del('done');
        location.reload();
    }
};

// 4. UI Logic
const UI = {
    show(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    modal(id, open) {
        document.getElementById(id).style.display = open ? 'flex' : 'none';
    },
    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    }
};

// 5. AR Logic (Corrected Camera)
const AR = {
    start() {
        UI.show('screen-ar');
        const wrapper = document.getElementById('ar-scene-wrapper');
        const stamps = App.config.stamps;
        
        let markersHtml = stamps.map(s => `
            <a-marker type="barcode" value="${s.barcodeId}" id="m-${s.id}">
                <a-box position="0 0.5 0" material="color: #c840ff; opacity: 0.8"></a-box>
            </a-marker>
        `).join('');

        wrapper.innerHTML = `
            <a-scene embedded arjs="sourceType:webcam; detectionMode:mono_and_matrix; matrixCodeType:3x3_hamming63; debugUIEnabled:false;">
                ${markersHtml}
                <a-entity camera></a-entity>
            </a-scene>
        `;

        // Force Video to Background
        const fixVideo = setInterval(() => {
            const video = document.querySelector('body > video');
            if (video) {
                video.style.zIndex = "-1";
                document.getElementById('ar-msg').textContent = "";
                clearInterval(fixVideo);
            }
        }, 500);

        stamps.forEach(s => {
            const m = document.getElementById(`m-${s.id}`);
            m.addEventListener('markerFound', () => App.onDetect(s));
        });
    },
    stop() {
        document.getElementById('ar-scene-wrapper').innerHTML = '';
        const v = document.querySelector('body > video');
        if (v) v.remove();
    }
};

// 6. App Main
const App = {
    config: DEFAULT_CONFIG,
    async init() {
        const saved = await DB.get('config');
        if (saved) this.config = saved;
        await State.load();
        this.render();
        this.bind();
    },
    render() {
        document.getElementById('ui-event-title').innerText = this.config.eventTitle;
        document.getElementById('progress-count').textContent = `${State.acq.length} / ${this.config.stamps.length}`;
        const pct = (State.acq.length / this.config.stamps.length) * 100;
        document.getElementById('progress-bar').style.width = pct + '%';
        
        const list = document.getElementById('stamp-list');
        list.innerHTML = this.config.stamps.map(s => `
            <div class="stamp-item ${State.acq.includes(s.id)?'acquired':''}">
                <div style="font-size:24px">${s.emoji}</div>
                <div style="flex:1"><b>${s.name}</b><br><small>${s.location}</small></div>
                <div>${State.acq.includes(s.id)?'✅':''}</div>
            </div>
        `).join('');

        if (State.done) {
            const btn = document.getElementById('btn-go-scan');
            btn.textContent = "🏆 コンプリート画面へ";
            btn.style.background = "var(--gold)";
        }
    },
    bind() {
        document.getElementById('btn-start').onclick = () => UI.modal('modal-start', true);
        document.getElementById('btn-start-ok').onclick = async () => {
            if (!State.start) { State.start = Date.now(); await DB.set('start', State.start); }
            UI.modal('modal-start', false); UI.show('screen-map');
        };
        document.getElementById('btn-go-scan').onclick = () => {
            if (State.done) UI.show('screen-complete');
            else AR.start();
        };
        document.getElementById('btn-ar-back').onclick = () => { AR.stop(); UI.show('screen-map'); };
        document.getElementById('btn-admin-entry').onclick = () => {
            const p = prompt("Password?");
            if (p === this.config.adminPassword) UI.show('screen-admin');
        };
        document.getElementById('btn-admin-back').onclick = () => UI.show('screen-title');
        document.getElementById('btn-reset-self').onclick = () => State.reset();
        
        // Admin Tab Logic
        document.querySelectorAll('.admin-tab').forEach(t => {
            t.onclick = () => {
                document.querySelectorAll('.admin-tab, .admin-tab-pane').forEach(el => el.classList.remove('active'));
                t.classList.add('active');
                document.getElementById('tab-' + t.dataset.tab).classList.add('active');
            };
        });
    },
    async onDetect(stamp) {
        if (await State.addStamp(stamp.id)) {
            AR.stop();
            document.getElementById('sa-name').textContent = stamp.name;
            UI.show('screen-stamp');
            this.render();
            if (State.acq.length === this.config.stamps.length) {
                State.done = true; await DB.set('done', true);
            }
        }
    }
};

window.onload = () => App.init();