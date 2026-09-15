/* =========================================================
   momo.js - ももちゃんのあそぼうランド 共通モジュール
   ========================================================= */
(function(){
  'use strict';

  var SETTINGS_KEY = 'momo_settings_v1';
  var STICKER_KEY  = 'momo_stickers_v1';
  var STAMP_KEY    = 'momo_stamps_v1';
  var SCREENTIME_KEY = 'momo_screentime_v1';

  /* =========================================================
     設定
     ========================================================= */
  var settings = {
    bgmMode: 'fun',
    bgmVol: 50,
    sfxVol: 70,
    soundOn: true,
    screentimeMin: 0
  };

  function loadSettings(){
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw){
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object'){
          if (obj.bgmMode === 'fun' || obj.bgmMode === 'calm' || obj.bgmMode === 'random') settings.bgmMode = obj.bgmMode;
          if (typeof obj.bgmVol === 'number') settings.bgmVol = Math.max(0, Math.min(100, obj.bgmVol));
          if (typeof obj.sfxVol === 'number') settings.sfxVol = Math.max(0, Math.min(100, obj.sfxVol));
          if (typeof obj.soundOn === 'boolean') settings.soundOn = obj.soundOn;
          if (typeof obj.screentimeMin === 'number') settings.screentimeMin = Math.max(0, obj.screentimeMin);
        }
      }
    } catch(e){}
  }
  function saveSettings(){
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e){}
  }

  /* =========================================================
     音：AudioContext と BGM
     ========================================================= */
  var ctx = null;
  var sfxGain = null;
  var bgmGain = null;
  var bgmTimer = null;
  var bgmLoopTime = 0;
  var currentTrack = null;
  var isDucked = false;
  var audioUnlocked = false;
  var unlockListenerAttached = false;
  var screenTimeActive = false;
  var bgmDisabled = false;

  function getBgmGainValue(quiet){ return (settings.bgmVol / 100) * (quiet ? 0.07 : 0.20); }
  function getSfxGainValue(){ return (settings.sfxVol / 100) * 0.70; }

  var F = {
    C3:130.81, F3:174.61, G3:196.00, A3:220.00,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
    C6:1046.50, E6:1318.51, DS4:311.13
  };

  var TRACKS = [
    { mood:'fun', bpm:116,
      melody:[[0,F.E5,1],[1,F.G5,1],[2,F.A5,1],[3,F.G5,1],[4,F.E5,1],[5,F.D5,1],[6,F.C5,2],
              [8,F.D5,1],[9,F.E5,1],[10,F.G5,1],[11,F.E5,1],[12,F.E5,1],[13,F.D5,1],[14,F.C5,2]],
      bass:[[0,F.C3,4],[4,F.F3,4],[8,F.G3,4],[12,F.C3,4]] },
    { mood:'fun', bpm:132,
      melody:[[0,F.C5,.5],[.5,F.E5,.5],[1,F.G5,.5],[1.5,F.E5,.5],[2,F.G5,.5],[2.5,F.A5,.5],[3,F.G5,1],
              [4,F.A5,.5],[4.5,F.G5,.5],[5,F.F5,.5],[5.5,F.E5,.5],[6,F.D5,.5],[6.5,F.E5,.5],[7,F.F5,1],
              [8,F.E5,.5],[8.5,F.G5,.5],[9,F.C6,1],[10,F.A5,.5],[10.5,F.G5,.5],[11,F.E5,1],
              [12,F.F5,.5],[12.5,F.E5,.5],[13,F.D5,.5],[13.5,F.C5,.5],[14,F.G4,1],[15,F.C5,1]],
      bass:[[0,F.C3,2],[2,F.C3,2],[4,F.F3,2],[6,F.G3,2],[8,F.C3,2],[10,F.A3,2],[12,F.F3,2],[14,F.G3,2]] },
    { mood:'calm', bpm:76,
      melody:[[0,F.E5,1.5],[1.5,F.D5,.5],[2,F.C5,2],[4,F.D5,1.5],[5.5,F.E5,.5],[6,F.G5,2],
              [8,F.G5,1],[9,F.F5,1],[10,F.E5,1],[11,F.D5,1],[12,F.C5,2],[14,F.E5,1],[15,F.C5,1]],
      bass:[[0,F.C3,4],[4,F.A3,4],[8,F.F3,4],[12,F.G3,4]] },
    { mood:'calm', bpm:88,
      melody:[[0,F.C5,1],[1,F.E5,1],[2,F.G5,1.5],[3.5,F.E5,.5],[4,F.F5,1],[5,F.A5,1],[6,F.G5,2],
              [8,F.E5,1],[9,F.G5,1],[10,F.C6,1.5],[11.5,F.A5,.5],[12,F.G5,1],[13,F.F5,1],[14,F.E5,1],[15,F.C5,1]],
      bass:[[0,F.C3,4],[4,F.F3,4],[8,F.C3,2],[10,F.A3,2],[12,F.F3,2],[14,F.G3,2]] }
  ];

  function getTrackPool(){
    if (settings.bgmMode === 'calm') return TRACKS.filter(function(t){ return t.mood === 'calm'; });
    if (settings.bgmMode === 'fun')  return TRACKS.filter(function(t){ return t.mood === 'fun'; });
    return TRACKS.slice();
  }
  function pickTrack(){
    var p = getTrackPool();
    return p[Math.floor(Math.random() * p.length)] || TRACKS[0];
  }

  function initAudio(){
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = getSfxGainValue();
    sfxGain.connect(ctx.destination);
  }

  function playNote(freq, t0, dur, type, dest, vol){
    if (!ctx || !dest) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, 0.05));
    osc.connect(g); g.connect(dest);
    osc.start(t0); osc.stop(t0 + dur + 0.08);
  }

  function scheduleTrack(t0, track){
    var beat = 60 / track.bpm;
    var loopDur = 16 * beat;
    track.melody.forEach(function(n){
      playNote(n[1], t0 + n[0] * beat, n[2] * beat * 0.9, 'triangle', bgmGain, 0.5);
    });
    track.bass.forEach(function(n){
      playNote(n[1], t0 + n[0] * beat, n[2] * beat * 0.85, 'sine', bgmGain, 0.42);
    });
    if (track.mood === 'fun'){
      playNote(F.C6, t0 + 6 * beat,  0.5, 'sine', bgmGain, 0.10);
      playNote(F.E6, t0 + 14 * beat, 0.5, 'sine', bgmGain, 0.10);
    }
    return loopDur;
  }

  function pumpBGM(){
    if (!ctx || !bgmGain) return;
    if (!currentTrack) currentTrack = pickTrack();
    while (bgmLoopTime < ctx.currentTime + 2.5){
      var dur = scheduleTrack(bgmLoopTime, currentTrack);
      bgmLoopTime += dur;
    }
  }

  function startBGM(){
    if (bgmDisabled) return;
    if (!ctx || !settings.soundOn) return;
    stopBGM();
    bgmGain = ctx.createGain();
    bgmGain.gain.value = getBgmGainValue(isDucked);
    bgmGain.connect(ctx.destination);
    currentTrack = pickTrack();
    bgmLoopTime = ctx.currentTime + 0.2;
    pumpBGM();
    bgmTimer = setInterval(pumpBGM, 700);
  }

  function stopBGM(){
    if (bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; }
    if (bgmGain){ try { bgmGain.disconnect(); } catch(e){} bgmGain = null; }
    currentTrack = null;
  }

  function applyBgmGain(){
    if (!ctx || !bgmGain) return;
    var target = getBgmGainValue(isDucked);
    try {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime);
      bgmGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.15);
    } catch(e){ bgmGain.gain.value = target; }
  }

  function duckBGM(quiet){
    isDucked = quiet;
    applyBgmGain();
  }

  /* =========================================================
     汎用効果音
     ========================================================= */
  function sfxTone(freq, delay, dur, type, vol){
    if (!settings.soundOn || !ctx || !sfxGain) return;
    var t0 = ctx.currentTime + (delay || 0);
    playNote(freq, t0, dur || 0.1, type || 'sine', sfxGain, (vol != null ? vol : 0.2));
  }

  function sfxTap(){ sfxTone(880, 0, 0.09, 'sine', 0.22); }
  function sfxPop(){ sfxTone(1250 + Math.random()*250, 0, 0.07, 'sine', 0.10); }
  function sfxGrab(){ sfxTone(660, 0, 0.08, 'sine', 0.20); }
  function sfxCorrect(){
    sfxTone(F.C5, 0,    0.42, 'triangle', 0.34);
    sfxTone(F.E5, 0.10, 0.42, 'triangle', 0.34);
    sfxTone(F.G5, 0.20, 0.42, 'triangle', 0.34);
    sfxTone(F.C6, 0.30, 0.42, 'triangle', 0.34);
  }
  function sfxWrong(){
    sfxTone(F.G4,  0,    0.20, 'sine', 0.20);
    sfxTone(F.DS4, 0.17, 0.30, 'sine', 0.20);
  }
  function sfxLevelUp(){
    sfxTone(F.C5, 0,    0.45, 'triangle', 0.30);
    sfxTone(F.E5, 0.09, 0.45, 'triangle', 0.30);
    sfxTone(F.G5, 0.18, 0.45, 'triangle', 0.30);
    sfxTone(F.C6, 0.27, 0.45, 'triangle', 0.30);
    sfxTone(F.E6, 0.36, 0.45, 'triangle', 0.30);
  }
  function sfxStar(){
    sfxTone(1319, 0,    0.12, 'sine', 0.20);
    sfxTone(1760, 0.08, 0.22, 'sine', 0.18);
  }
  function sfxShake(){
    sfxTone(140, 0,    0.35, 'sawtooth', 0.10);
    sfxTone(170, 0.12, 0.28, 'sawtooth', 0.09);
    sfxTone(200, 0.24, 0.22, 'sawtooth', 0.08);
  }
  function sfxReveal(){
    sfxTone(523,  0,    0.20, 'sine', 0.18);
    sfxTone(784,  0.10, 0.25, 'sine', 0.16);
    sfxTone(1047, 0.22, 0.28, 'sine', 0.14);
  }
  function sfxBookOpen(){
    sfxTone(F.C5, 0,    0.30, 'sine', 0.20);
    sfxTone(F.E5, 0.06, 0.30, 'sine', 0.20);
    sfxTone(F.G5, 0.12, 0.30, 'sine', 0.20);
    sfxTone(F.C6, 0.18, 0.30, 'sine', 0.20);
  }
  function sfxStickerTap(){
    sfxTone(F.G5, 0,    0.16, 'triangle', 0.24);
    sfxTone(F.C6, 0.09, 0.32, 'triangle', 0.22);
  }
  function sfxStart(){
    sfxTone(F.C5, 0,    0.40, 'triangle', 0.28);
    sfxTone(F.G5, 0.11, 0.40, 'triangle', 0.28);
    sfxTone(F.C6, 0.22, 0.40, 'triangle', 0.28);
    sfxTone(F.G5, 0.33, 0.40, 'triangle', 0.28);
    sfxTone(F.C6, 0.44, 0.40, 'triangle', 0.28);
    sfxTone(F.E6, 0.55, 0.40, 'triangle', 0.28);
  }

  /* =========================================================
     音声合成
     ========================================================= */
  var speechSupported = ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window);
  var jaVoice = null;

  function pickVoice(){
    if (!speechSupported) return;
    var voices = window.speechSynthesis.getVoices();
    jaVoice = voices.find(function(v){
      return v.lang && v.lang.toLowerCase().indexOf('ja') === 0;
    }) || null;
  }
  if (speechSupported){
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function buildUtterance(text, rate, pitch){
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = rate || 0.9;
    u.pitch = pitch || 1.35;
    u.volume = 1;
    return u;
  }

  function speak(text, rateOrOpts, pitch){
    if (!settings.soundOn || !speechSupported) return;
    var opts = {};
    if (rateOrOpts && typeof rateOrOpts === 'object'){
      opts = rateOrOpts;
    } else {
      opts.rate = rateOrOpts;
      opts.pitch = pitch;
    }
    var finalRate = (opts.rate != null) ? opts.rate :
                    (opts.voice && opts.voice.rate != null) ? opts.voice.rate : 0.9;
    var finalPitch = (opts.pitch != null) ? opts.pitch :
                     (opts.voice && opts.voice.pitch != null) ? opts.voice.pitch : 1.35;
    try {
      if (opts.queue !== true) window.speechSynthesis.cancel();
      setTimeout(function(){
        try {
          window.speechSynthesis.speak(buildUtterance(text, finalRate, finalPitch));
        } catch(e){}
      }, 60);
    } catch(e){}
  }

  function speakWithEnd(text, onend, rateOrOpts, pitch){
    var safeOnend = onend || function(){};
    if (!settings.soundOn || !speechSupported){
      setTimeout(safeOnend, 500); return;
    }
    var opts = {};
    if (rateOrOpts && typeof rateOrOpts === 'object'){
      opts = rateOrOpts;
    } else {
      opts.rate = rateOrOpts;
      opts.pitch = pitch;
    }
    var finalRate = (opts.rate != null) ? opts.rate :
                    (opts.voice && opts.voice.rate != null) ? opts.voice.rate : 0.9;
    var finalPitch = (opts.pitch != null) ? opts.pitch :
                     (opts.voice && opts.voice.pitch != null) ? opts.voice.pitch : 1.35;
    try {
      if (opts.queue !== true) window.speechSynthesis.cancel();
      setTimeout(function(){
        var u = buildUtterance(text, finalRate, finalPitch);
        var done = false;
        var finish = function(){ if (done) return; done = true; safeOnend(); };
        u.onend = finish;
        u.onerror = finish;
        try { window.speechSynthesis.speak(u); } catch(e){ finish(); return; }
        setTimeout(finish, Math.max(2500, text.length * 260));
      }, 60);
    } catch(e){ setTimeout(safeOnend, 500); }
  }

  function speakWord(text, onend){
    if (!settings.soundOn || !speechSupported){
      setTimeout(onend || function(){}, 380); return;
    }
    try {
      window.speechSynthesis.cancel();
      setTimeout(function(){
        var u = buildUtterance(text, 0.82, 1.35);
        var done = false;
        var finish = function(){ if (done) return; done = true; if (onend) onend(); };
        u.onend = finish;
        u.onerror = finish;
        try { window.speechSynthesis.speak(u); } catch(e){ finish(); return; }
        setTimeout(finish, 1400);
      }, 60);
    } catch(e){ if (onend) setTimeout(onend, 300); }
  }

  function cancelSpeech(){
    if (!speechSupported) return;
    try { window.speechSynthesis.cancel(); } catch(e){}
  }

  function warmupSpeech(){
    if (!speechSupported) return;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'ja-JP';
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    } catch(e){}
  }

  /* =========================================================
     親（ハブ）への通知
     ========================================================= */
  function notifyParent(msg){
    try {
      if (window.parent && window.parent !== window){
        window.parent.postMessage(msg, '*');
      }
    } catch(e){}
  }

  /* =========================================================
     シール・スタンプ保存
     ========================================================= */
  function loadArray(key){
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){ return []; }
  }
  function normalizeArray(arr){
    return arr.map(function(it){
      if (typeof it === 'string') return { emoji: it, from: 'kazu' };
      if (it && typeof it === 'object' && it.emoji){
        return { emoji: it.emoji, from: it.from || 'kazu', color: it.color };
      }
      return null;
    }).filter(Boolean);
  }

  function saveSticker(emoji, from){
    try {
      var arr = normalizeArray(loadArray(STICKER_KEY));
      arr.push({ emoji: emoji, from: from || 'kazu' });
      localStorage.setItem(STICKER_KEY, JSON.stringify(arr));
      notifyParent({ type: 'updateBadge' });
    } catch(e){}
  }
  function saveStamp(emoji, from, color){
    try {
      var arr = normalizeArray(loadArray(STAMP_KEY));
      arr.push({ emoji: emoji, from: from || 'animals', color: color });
      localStorage.setItem(STAMP_KEY, JSON.stringify(arr));
      notifyParent({ type: 'updateBadge' });
    } catch(e){}
  }

  function getStickerCount(){
    var a = loadArray(STICKER_KEY);
    return Array.isArray(a) ? a.length : 0;
  }
  function getStampCount(){
    var a = loadArray(STAMP_KEY);
    return Array.isArray(a) ? a.length : 0;
  }
  function getTotalCount(){ return getStickerCount() + getStampCount(); }

  function getMyStickerEmojis(from){
    var arr = normalizeArray(loadArray(STICKER_KEY));
    return arr.filter(function(it){ return it.from === from; })
              .map(function(it){ return it.emoji; });
  }
  function getMyStampEmojis(from){
    var arr = normalizeArray(loadArray(STAMP_KEY));
    return arr.filter(function(it){ return it.from === from; })
              .map(function(it){ return it.emoji; });
  }

  function updateBookBadge(){
    try {
      var badge = document.querySelector('#bookBadge');
      if (!badge) return;
      var n = getTotalCount();
      badge.textContent = n;
      badge.classList.toggle('show', n > 0);
    } catch(e){}
  }

  /* =========================================================
     スクリーンタイム
     ========================================================= */
  var screenTime = {
    dateKey: null,
    accumulatedMs: 0,
    runningSince: 0,
    limitMin: 0,
    warningFired: false,
    expiredFired: false,
    onWarning: null,
    onExpired: null,
    checkTimer: null
  };

  function getTodayKey(){
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = '0' + m;
    var day = String(d.getDate());
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
  }

  function loadScreenTime(){
    try {
      var raw = localStorage.getItem(SCREENTIME_KEY);
      if (raw){
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object'){
          screenTime.dateKey = obj.dateKey || null;
          screenTime.accumulatedMs = (typeof obj.accumulatedMs === 'number') ? obj.accumulatedMs : 0;
        }
      }
    } catch(e){}
    var today = getTodayKey();
    if (screenTime.dateKey !== today){
      screenTime.dateKey = today;
      screenTime.accumulatedMs = 0;
    }
    screenTime.runningSince = 0;
    screenTime.limitMin = settings.screentimeMin || 0;
    screenTime.warningFired = false;
    screenTime.expiredFired = false;
  }

  function saveScreenTime(){
    try {
      localStorage.setItem(SCREENTIME_KEY, JSON.stringify({
        dateKey: screenTime.dateKey,
        accumulatedMs: screenTime.accumulatedMs
      }));
    } catch(e){}
  }

  function getCurrentAccumulatedMs(){
    var total = screenTime.accumulatedMs;
    if (screenTime.runningSince > 0){
      total += Date.now() - screenTime.runningSince;
    }
    return total;
  }

  function startScreenTimer(){
    if (!screenTimeActive) return;
    if (screenTime.limitMin <= 0) return;
    if (screenTime.expiredFired) return;
    if (screenTime.runningSince > 0) return;
    screenTime.runningSince = Date.now();
  }

  function stopScreenTimer(){
    if (screenTime.runningSince > 0){
      screenTime.accumulatedMs += Date.now() - screenTime.runningSince;
      screenTime.runningSince = 0;
      saveScreenTime();
    }
  }

  function checkScreenTime(){
    if (!screenTimeActive) return;
    if (screenTime.limitMin <= 0) return;
    if (screenTime.expiredFired) return;

    var totalMs = getCurrentAccumulatedMs();
    var limitMs = screenTime.limitMin * 60 * 1000;
    var remainingMs = limitMs - totalMs;

    /* 残り1分前の警告（1回だけ） */
    if (!screenTime.warningFired && remainingMs > 0 && remainingMs <= 60 * 1000){
      screenTime.warningFired = true;
      if (screenTime.onWarning){
        try { screenTime.onWarning(); } catch(e){}
      }
    }

    /* 時間切れ */
    if (remainingMs <= 0){
      screenTime.expiredFired = true;
      stopScreenTimer();
      if (screenTime.onExpired){
        try { screenTime.onExpired(); } catch(e){}
      }
    }
  }

  function startScreenTimeChecker(){
    if (screenTime.checkTimer) return;
    screenTime.checkTimer = setInterval(checkScreenTime, 1000);
    /* 起動直後にも1回チェック */
    checkScreenTime();
  }

  function resetScreenTime(){
    screenTime.accumulatedMs = 0;
    screenTime.runningSince = 0;
    screenTime.warningFired = false;
    screenTime.expiredFired = false;
    screenTime.dateKey = getTodayKey();
    saveScreenTime();
    startScreenTimer();
  }

  function setScreenTimeLimit(min){
    settings.screentimeMin = min;
    screenTime.limitMin = min;
    resetScreenTime();
    saveSettings();
  }

  function getScreenTimeRemaining(){
    if (screenTime.limitMin <= 0) return Infinity;
    var totalMs = getCurrentAccumulatedMs();
    var limitMs = screenTime.limitMin * 60 * 1000;
    return Math.max(0, limitMs - totalMs);
  }

  function isScreenTimeExpired(){
    return screenTime.expiredFired;
  }

  function setScreenTimeCallbacks(cbs){
    cbs = cbs || {};
    if (typeof cbs.onWarning === 'function') screenTime.onWarning = cbs.onWarning;
    if (typeof cbs.onExpired === 'function') screenTime.onExpired = cbs.onExpired;
  }

  /* =========================================================
     アンロック
     ========================================================= */
  function unlockAudio(){
    if (audioUnlocked && bgmTimer) return;
    audioUnlocked = true;
    initAudio();
    if (ctx && ctx.state === 'suspended'){ try { ctx.resume(); } catch(e){} }
    warmupSpeech();
    if (settings.soundOn && !bgmTimer) startBGM();
    if (screenTimeActive) startScreenTimer();
  }

  function attachUnlockListeners(){
    if (unlockListenerAttached) return;
    unlockListenerAttached = true;
    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('click', unlockAudio);
  }

  /* =========================================================
     可視状態
     ========================================================= */
  function attachVisibilityHandler(){
    document.addEventListener('visibilitychange', function(){
      if (document.hidden){
        stopBGM();
        cancelSpeech();
        if (screenTimeActive) stopScreenTimer();
      } else {
        if (ctx && ctx.state === 'suspended'){ try { ctx.resume(); } catch(e){} }
        if (settings.soundOn && !bgmTimer && audioUnlocked) startBGM();
        if (screenTimeActive){
          startScreenTimer();
          checkScreenTime();
        }
      }
    });
    document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  }

  /* =========================================================
     初期化
     ========================================================= */
  function init(options){
    options = options || {};
    loadSettings();
    loadScreenTime();

    /* ★ noBGM オプション：ハブ画面など BGM を鳴らしたくない window で指定 */
    if (options.noBGM === true) bgmDisabled = true;

    initAudio();
    attachUnlockListeners();

    if (options.visibility !== false){
      attachVisibilityHandler();
    }

    /* screenTime オプションが true のときだけタイマー起動 */
    if (options.screenTime === true){
      screenTimeActive = true;
      startScreenTimeChecker();
    }

    if (settings.soundOn){
      try {
        if (ctx && ctx.state === 'running'){
          audioUnlocked = true;
          startBGM();
        }
      } catch(e){}
    }
  }

  /* =========================================================
     公開API
     ========================================================= */
  var Momo = {
    init: init,
    reloadSettings: loadSettings,

    settings: settings,

    startBGM: startBGM,
    stopBGM: stopBGM,
    duckBGM: duckBGM,
    applyBgmGain: applyBgmGain,

    now: function(){ return ctx ? ctx.currentTime : 0; },

    sfx: {
      tone: sfxTone,
      tap: sfxTap,
      pop: sfxPop,
      grab: sfxGrab,
      correct: sfxCorrect,
      wrong: sfxWrong,
      levelUp: sfxLevelUp,
      star: sfxStar,
      shake: sfxShake,
      reveal: sfxReveal,
      bookOpen: sfxBookOpen,
      stickerTap: sfxStickerTap,
      start: sfxStart
    },

    speak: speak,
    speakWithEnd: speakWithEnd,
    speakWord: speakWord,
    cancelSpeech: cancelSpeech,
    warmupSpeech: warmupSpeech,

    notifyParent: notifyParent,

    saveSticker: saveSticker,
    saveStamp: saveStamp,
    getStickerCount: getStickerCount,
    getStampCount: getStampCount,
    getTotalCount: getTotalCount,
    getMyStickerEmojis: getMyStickerEmojis,
    getMyStampEmojis: getMyStampEmojis,
    updateBookBadge: updateBookBadge,

    /* ★ スクリーンタイム API */
    screenTime: {
      setCallbacks: setScreenTimeCallbacks,
      getLimitMin: function(){ return screenTime.limitMin; },
      setLimitMin: setScreenTimeLimit,
      getRemainingMs: getScreenTimeRemaining,
      isExpired: isScreenTimeExpired,
      reset: resetScreenTime
    }
  };

  window.Momo = Momo;
})();
