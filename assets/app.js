/* REQUIEⅢ キャラクター診断 — 共通レイアウト・トップ・参加者画面（ChatGPT Sites版 v5 の shell.tsx / page.tsx / player.tsx を移植）
 * GM画面は gm.js に分けてあり、参加者のスマホには読み込まれない。
 * 推薦の計算・配点はこのファイルに一切含めない（Apps Script 側だけで計算する）。 */
(function () {
  'use strict';
  var API = window.REQUIE3_API;
  var page = document.body.getAttribute('data-page');
  var gm = page === 'gm';

  // ── 共通 ──
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function br(s) { return esc(s).replace(/\n/g, '<br/>'); }
  function $(id) { return document.getElementById(id); }
  async function api(payload) {
    if (!API || /REPLACE/.test(API)) throw Error('保存先が設定されていません。GMに連絡してください。');
    var r;
    try { r = await fetch(API, {method: 'POST', body: JSON.stringify(payload), redirect: 'follow'}); }
    catch (e) { throw Error('通信できませんでした。電波の良い場所で、もう一度お試しください。'); }
    var data;
    try { data = await r.json(); } catch (e) { throw Error('処理できませんでした。もう一度お試しください。'); }
    if (!data.ok) { var x = Error(data.error || '処理できませんでした。'); x.status = data.status; throw x; }
    return data;
  }
  function uuid() {
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.from(b, function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // 戻る操作でキャッシュから復元されたら、前の人の入力を残さず読み込み直す
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  // ── 共通レイアウト（shell.tsx） ──
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="layout"><aside class="story"><a class="brand" href="./">REQUIE<span>Ⅲ</span><small>MURDER MYSTERY</small></a><div class="story-center"><div class="cover-title" aria-hidden="true"><img src="assets/cover-title.jpg" alt="" width="960" height="679"/></div>' +
    '<p class="overline">' + (gm ? 'BEHIND THE STORY' : 'FIND YOUR CHARACTER') + '</p><h1>' + (gm ? '七人の選択を、<br/>物語の始まりへ。' : 'これからあなたが<br/>被る仮面は？') + '</h1><p class="story-description">' + (gm ? '七人の人物。七つの視点。<br/>物語を始める、その前に。' : '本当のあなたを知る10の質問<br/>おすすめの仮面を選びます') + '</p></div><div class="story-bottom"><span>REQUIEM · CHARACTER CASTING</span><span>01 — 07</span></div></aside>' +
    '<main><header class="topbar"><span>' + (gm ? 'GAME MASTER' : 'CHARACTER MATCH') + '</span><span class="edition">試作版</span></header><div id="app"></div><footer><span>REQUIEⅢ</span><span>結果はGMにだけ表示されます</span></footer></main></div>');
  var app = $('app');

  if (page === 'home') home();
  else if (page === 'play') player();
  else if (page === 'gm') window.REQUIE3 = {esc: esc, api: api, $: $, app: app};

  // ── トップ（page.tsx） ──
  function home() {
    app.innerHTML = '<section class="intro"><p class="eyebrow">CASTING YOUR STORY</p><h2>この物語で、<br/>あなたは誰になる。</h2><p class="lead">10の質問から、おすすめの役を見つけます。<br/>回答後、結果はGMだけが確認できます。</p><div class="facts"><div class="fact"><strong>10</strong><span>問</span><small>QUESTIONS</small></div><div class="fact"><strong>約3</strong><span>分</span><small>TIME</small></div><div class="fact"><strong>7</strong><span>人</span><small>PLAYERS</small></div></div><p class="lead">参加する方は、GMから届いた<br/>専用の回答用URLを開いてください。</p><a class="primary link-button" href="gm.html">GMとして卓を作成する<span aria-hidden="true">→</span></a><p class="note">プレイヤー画面には、おすすめの役や判定基準は表示されません。</p></section>';
  }

  // ── 参加者（player.tsx） ──
  function player() {
    // lib/questions.ts（質問文・選択肢のみ。配点はサーバー側）
    var questions = [
      {title: '意見が割れたとき、\nあなたはどう動く？', hint: '普段の自分に近いものを選んでください。', options: ['話をまとめる', '理屈で説得する', '黙っている人に声をかける', '自分の意見を貫く']},
      {title: '物語の中で、\n大切にしたくなるものは？', hint: '一番惹かれるものを選んでください。', options: ['仲間', '自由', '愛する人', '夢']},
      {title: '休みの日の\n過ごし方は？', hint: '普段の自分に近いものを選んでください。', options: ['誰かと一緒に過ごす', '一人で好きなことをする', '思いつきで出かける', '用事をきっちり片付ける']},
      {title: 'レストランで\nメニューを選ぶときは？', hint: '直感で選んでください。', options: ['すぐ決める', 'いつものを頼む', '迷ってしまう', 'あえて珍しいものを頼む']},
      {title: 'やりたいキャラクターの\n性格は？', hint: '一番演じてみたいものを選んでください。', options: ['熱血', '正義感の塊', '冷静', '素直', '秀才', '犯人']},
      {title: '議論の時間に、\n楽しみたいことは？', hint: '得意かどうかより、やってみたいことを。', options: ['話を前に進める', '人の話をじっくり聞く', '相手を説得する', '推理を披露する']},
      {title: '役を演じる面白さは、\nどこにあると思う？', hint: '一番近いものを選んでください。', options: ['自分とは違う人間になれるところ', '現実ではありえない役になれるところ', 'ふざけられるところ', '役にはあまりなりきらない']},
      {title: '人に言われて\n一番うれしい言葉は？', hint: '最後の質問です。直感で選んでください。', options: ['「頼りになるね」', '「やさしいね」', '「一緒にいると楽しい」', '「まっすぐだね」']}
    ];
    var dislikes = [['danger', '危険なキャラクター'], ['complex', '複雑なキャラクター'], ['morals', 'モラルのないキャラクター'], ['secrets', '秘密の多いキャラクター'], ['male', '男性キャラクター'], ['female', '女性キャラクター']];
    var experienceLabels = ['0〜4回', '5〜9回', '10回以上'];
    var roomId = new URLSearchParams(location.search).get('room') || '';

    // 状態はこのページの中だけ（保存しない）。開くたびに必ず空から始まる。
    var room = null, error = '', nickname = '', stage = 'intro', step = 0;
    var answers = [null, null, null, null, null, null, null, null], avoids = null, experience = null, busy = false, token = null;

    function render() {
      if (!room) { app.innerHTML = '<section><p class="eyebrow">CHARACTER MATCH</p><h2>' + (error ? '卓を開けませんでした' : '卓を読み込み中…') + '</h2>' + (error ? '<p role="alert" class="error">' + esc(error) + '</p>' : '') + '</section>'; return; }
      if (stage === 'done') { app.innerHTML = '<section class="intro"><p class="eyebrow">THANK YOU</p><div class="submitted-mark" aria-hidden="true">✓</div><h2>回答を送りました。</h2><p class="lead">' + esc(nickname) + 'さん、回答はGMに届きました。<br/>この画面を閉じて、GMからの案内をお待ちください。</p><p class="note">診断結果はGMだけが確認できます。</p></section>'; return; }
      if (!room.open) { app.innerHTML = '<section class="intro"><p class="eyebrow">RECEPTION CLOSED</p><h2>受付は終了しました。</h2><p class="lead">GMに確認してください。</p></section>'; return; }
      if (stage === 'intro') {
        app.innerHTML = '<section class="intro"><p class="eyebrow">' + esc(room.title) + '</p><h2>この物語で、<br/>あなたは誰になる。</h2><p class="lead">考え方と、演じてみたい役について。<br/>10の質問から、あなたに合う役を見つけます。</p><div class="facts"><div class="fact"><strong>10</strong><span>問</span><small>QUESTIONS</small></div><div class="fact"><strong>約3</strong><span>分</span><small>TIME</small></div></div><form id="start" autocomplete="off"><label class="field-label" for="nickname">GMに伝わる呼び名</label><input id="nickname" class="text-input" maxlength="30" required placeholder="ニックネームでOK" autocomplete="off"/><button class="primary" type="submit" id="startBtn" disabled>診断をはじめる<span aria-hidden="true">→</span></button></form><p class="note">回答と呼び名は、この卓のGMが確認するために保存されます。<br/>結果はプレイヤーには表示されません。</p></section>';
        var input = $('nickname'); input.value = nickname;
        $('startBtn').disabled = !nickname.trim();
        input.addEventListener('input', function () { nickname = input.value; $('startBtn').disabled = !nickname.trim(); });
        $('start').addEventListener('submit', function (e) { e.preventDefault(); if (nickname.trim()) { stage = 'questions'; move(0); } });
        return;
      }
      var title = step < 8 ? questions[step].title : step === 8 ? '苦手なキャラクターは\nいますか？' : 'マダミスの経験回数は？';
      var hint = step < 8 ? questions[step].hint : step === 8 ? '苦手なものをすべて選んでください。' : 'これまでに遊んだ回数を選んでください。';
      var options = step < 8 ? questions[step].options : step === 8 ? dislikes.map(function (x) { return x[1]; }).concat(['特にない']) : experienceLabels;
      function selected(i) { return step < 8 ? answers[step] === i : step === 8 ? (i === dislikes.length ? avoids !== null && avoids.length === 0 : !!(avoids && avoids.indexOf(dislikes[i][0]) !== -1)) : experience === i; }
      var valid = step < 8 ? answers[step] !== null : step === 8 ? avoids !== null : experience !== null;
      var doneCount = answers.filter(function (a) { return a !== null; }).length + Number(avoids !== null) + Number(experience !== null);
      var bars = ''; for (var i = 0; i < 10; i++) bars += '<i class="' + ((i < 8 ? answers[i] !== null : i === 8 ? avoids !== null : experience !== null) ? 'done' : '') + '"></i>';
      app.innerHTML = '<section class="question" id="panel" tabindex="-1"><div class="progress-meta"><span>QUESTION <strong>' + String(step + 1).padStart(2, '0') + '</strong> / 10</span><span>' + (step < 4 ? 'YOUR VALUES' : step < 8 ? 'YOUR PLAY STYLE' : 'YOUR PREFERENCES') + '</span></div><div class="progress" role="progressbar" aria-label="回答済みの質問数" aria-valuemin="0" aria-valuemax="10" aria-valuenow="' + doneCount + '">' + bars + '</div>' +
        '<h2 id="question-title">' + br(title) + '</h2><p class="hint">' + esc(hint) + '</p><div class="options" role="group" aria-labelledby="question-title">' +
        options.map(function (text, i) { return '<button type="button" class="option" data-i="' + i + '" aria-pressed="' + selected(i) + '"' + (busy ? ' disabled' : '') + '><span class="letter" aria-hidden="true">' + 'ABCDEFG'[i] + '</span><span>' + esc(text) + '</span><span class="check" aria-hidden="true"></span></button>'; }).join('') +
        '</div>' + (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
        '<div class="navigation"><button type="button" class="back" id="prev"' + (busy ? ' disabled' : '') + '>← ' + (step === 0 ? 'はじめに' : '前の質問') + '</button><button type="button" class="primary" id="next"' + (!valid || busy ? ' disabled' : '') + '>' + (busy ? '送信中…' : step === 9 ? 'GMに回答を送る' : '次の質問へ') + '<span aria-hidden="true">→</span></button></div></section>';
      app.querySelectorAll('.option').forEach(function (b) { b.addEventListener('click', function () { select(Number(b.getAttribute('data-i'))); }); });
      $('prev').addEventListener('click', function () { if (step === 0) { stage = 'intro'; error = ''; render(); } else move(step - 1); });
      $('next').addEventListener('click', function () { if (step < 9) move(step + 1); else send(); });
    }
    function move(n) {
      step = n; error = ''; render();
      requestAnimationFrame(function () { var p = $('panel'); if (!p) return; p.focus({preventScroll: true}); if (innerWidth < 601) p.scrollIntoView({block: 'start'}); });
    }
    function select(i) {
      if (step < 8) answers[step] = i;
      else if (step === 8) {
        if (i === dislikes.length) avoids = [];
        else {
          var arr = avoids || [], kind = dislikes[i][0];
          if (arr.indexOf(kind) !== -1) { var next = arr.filter(function (x) { return x !== kind; }); avoids = next.length ? next : null; }
          else {
            // 男性と女性は同時に選べない。片方を選ぶと、もう片方は外れる
            var without = kind === 'male' ? arr.filter(function (x) { return x !== 'female'; }) : kind === 'female' ? arr.filter(function (x) { return x !== 'male'; }) : arr;
            avoids = without.concat([kind]);
          }
        }
      } else experience = i;
      // 選択だけ更新する（画面を作り直さないので、タップのたびにフェードし直さない）
      var valid = step < 8 ? answers[step] !== null : step === 8 ? avoids !== null : experience !== null;
      app.querySelectorAll('.option').forEach(function (b) {
        var n = Number(b.getAttribute('data-i'));
        var on = step < 8 ? answers[step] === n : step === 8 ? (n === dislikes.length ? avoids !== null && avoids.length === 0 : !!(avoids && avoids.indexOf(dislikes[n][0]) !== -1)) : experience === n;
        b.setAttribute('aria-pressed', String(on));
      });
      $('next').disabled = !valid;
      var bars = app.querySelectorAll('.progress i');
      bars.forEach(function (bar, n) { bar.className = (n < 8 ? answers[n] !== null : n === 8 ? avoids !== null : experience !== null) ? 'done' : ''; });
      app.querySelector('.progress').setAttribute('aria-valuenow', String(answers.filter(function (a) { return a !== null; }).length + Number(avoids !== null) + Number(experience !== null)));
    }
    async function send() {
      if (busy || experience === null || avoids === null || answers.some(function (a) { return a === null; })) return;
      busy = true; error = ''; render();
      try {
        token = token || uuid();
        await api({action: 'submit', roomId: roomId, nickname: nickname.trim(), answers: answers, dislikes: avoids, experience: experience, submissionId: token});
        stage = 'done';
      } catch (e) { error = e.message || '送信できませんでした。もう一度お試しください。'; }
      finally { busy = false; render(); }
    }

    render();
    if (!/^[a-f0-9-]{36}$/.test(roomId)) { error = '回答用URLが正しくありません。GMから届いたURLを開き直してください。'; render(); return; }
    api({action: 'room', id: roomId}).then(function (d) { room = {title: d.title, open: d.open}; render(); }).catch(function (e) { error = e.message || '卓を読み込めませんでした。'; render(); });
  }

})();
