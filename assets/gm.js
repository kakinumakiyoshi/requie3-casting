/* REQUIEⅢ キャラクター診断 — GM画面（gm/page.tsx・gm-client.tsx を移植）。gm.html だけが読み込む。 */
(function () {
  'use strict';
  var R = window.REQUIE3, esc = R.esc, api = R.api, $ = R.$, app = R.app;
  // ── GM（gm/page.tsx・gm-client.tsx） ──
  function gmPage() {
    var animals = ['イヌ', 'サイ', 'オットセイ', 'トラ', 'ヤギ', 'ネコ', 'スズメ'];
    var kinds = [['danger', '危険'], ['complex', '複雑'], ['morals', 'モラルなし'], ['secrets', '秘密が多い']];
    var token = null;
    try { token = sessionStorage.getItem('requie3_gm'); } catch (e) {}
    var list = [], room = null, title = 'レクイエムの卓', error = '', busy = false, status = '', rules = null, lastUpdate = '', shareUrl = '', timer = null;

    function call(payload) {
      payload.token = token;
      return api(payload).catch(function (e) { if (e.status === 401) { logoutLocal(); } throw e; });
    }
    function logoutLocal() { token = null; try { sessionStorage.removeItem('requie3_gm'); } catch (e) {} room = null; if (timer) clearInterval(timer); }
    function playUrl(id) { return new URL('play.html?room=' + id, location.href).href; }

    function render() {
      if (!token) {
        app.innerHTML = '<section class="intro"><p class="eyebrow">GAME MASTER</p><h2>GM専用ページ</h2><p class="lead">GMパスワードを知っている人だけが、<br/>回答結果を確認できます。</p><form id="login"><label class="field-label" for="pw">GMパスワード</label><input id="pw" class="text-input" type="password" autocomplete="current-password" required/><button class="primary" id="loginBtn"' + (busy ? ' disabled' : '') + '>' + (busy ? '確認中…' : 'GMとしてログイン') + '<span aria-hidden="true">→</span></button></form>' + (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') + '</section>';
        $('login').addEventListener('submit', function (e) {
          e.preventDefault(); var pw = $('pw').value; if (!pw) return;
          action(async function () { var d = await api({action: 'gmLogin', password: pw}); token = d.token; try { sessionStorage.setItem('requie3_gm', token); } catch (x) {} await loadList(); });
        });
        return;
      }
      var logout = '<p class="note"><button type="button" class="back" id="logout">ログアウト</button></p>';
      if (!room) {
        app.innerHTML = '<section class="gm-home"><p class="eyebrow">GAME MASTER</p><h2 class="gm-heading">七人の配役を、<br/>ここから。</h2><p class="lead">卓を作成して、回答用URLを参加者に送ります。<br/>結果は、GMパスワードでログインした画面でだけ確認できます。</p><form id="create"><label class="field-label" for="room-title">卓の名前</label><input class="text-input" id="room-title" maxlength="60" required/><button class="primary" id="createBtn"' + (busy || !title.trim() ? ' disabled' : '') + '>' + (busy ? '作成中…' : '新しい卓を作る') + '<span aria-hidden="true">＋</span></button></form>' +
          (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
          (list.length ? '<div class="room-list"><h3>作成した卓</h3>' + list.map(function (r) { return '<button type="button" class="room-item" data-id="' + esc(r.id) + '"' + (busy ? ' disabled' : '') + '><span>' + esc(r.title) + '</span><small>' + (r.open ? '受付中' : '受付終了') + ' →</small></button>'; }).join('') + '</div>' : '') + logout + '</section>';
        var t = $('room-title'); t.value = title;
        t.addEventListener('input', function () { title = t.value; $('createBtn').disabled = busy || !title.trim(); });
        $('create').addEventListener('submit', function (e) { e.preventDefault(); action(async function () { var d = await call({action: 'gmCreate', title: title}); await openRoom(d.id); await loadList(); }); });
        app.querySelectorAll('.room-item').forEach(function (b) { b.addEventListener('click', function () { action(function () { return openRoom(b.getAttribute('data-id')); }); }); });
        $('logout').addEventListener('click', doLogout);
        return;
      }
      var resultsHtml = room.responses.length === 0 ? '<div class="empty-results">回答を待っています。<small>回答が届くと、ここに表示されます。</small></div>' :
        '<div class="animal-results">' + room.responses.map(function (r) { return '<article class="animal-row"><span class="player-name">' + esc(r.nickname) + '</span><div class="animal-pair">' + r.animals.map(function (a) { return '<span class="animal">' + esc(a) + '</span>'; }).join('') + '</div></article>'; }).join('') + '</div>';
      var settings = '';
      if (rules) {
        settings = '<h3>苦手なタイプから除外する動物</h3><p class="note">「複雑」が苦手な人にはヤギを出しません。それ以外の対応は必要に応じて設定してください。</p><div class="rules-scroll"><table class="rules-table"><thead><tr><th>動物</th>' + kinds.map(function (k) { return '<th>' + k[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
          animals.map(function (a, i) { return '<tr><th>' + a + '</th>' + kinds.map(function (k) { return '<td><input type="checkbox" class="rule" data-k="' + k[0] + '" data-i="' + i + '" aria-label="' + a + '：' + k[1] + 'が苦手なら除外"' + (rules.excluded[k[0]].indexOf(i) !== -1 ? ' checked' : '') + (i === 4 && k[0] === 'complex' ? ' disabled' : '') + '/></td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div><h3>経験回数への配慮（仮設定）</h3><label class="toggle-line"><input type="checkbox" id="beginner"' + (rules.beginnerAvoid ? ' checked' : '') + '/>0〜4回の人にはヤギを出さない</label><label class="toggle-line"><input type="checkbox" id="intermediate"' + (rules.intermediatePenalty ? ' checked' : '') + '/>5〜9回の人にはヤギを控えめにする</label><button type="button" class="secondary" id="saveRules"' + (busy ? ' disabled' : '') + '>設定を保存する</button>';
      }
      var wasOpen = app.querySelector('details.gm-settings') && app.querySelector('details.gm-settings').open;
      app.innerHTML = '<section class="gm-room"><button type="button" class="back" id="toList">← 卓の一覧</button><div class="gm-title-row"><div><p class="eyebrow">GAME MASTER</p><h2 class="gm-heading">' + esc(room.title) + '</h2></div><span class="count">' + room.responses.length + '<small> / 7</small></span></div>' +
        '<div class="share-box"><label class="field-label" for="share-url">参加者に渡す回答用URL</label><input id="share-url" class="text-input" readonly/><button type="button" class="secondary" id="copy">回答用URLをコピー</button><p class="note">このURLでは回答だけができます。結果は閲覧できません。</p></div>' +
        '<div class="results-header"><h3>おすすめの動物</h3><button type="button" class="back" id="refresh"' + (busy ? ' disabled' : '') + '>更新 ↻</button></div>' + resultsHtml +
        '<p class="note update-status">15秒ごとに更新 · 最終更新 ' + esc(lastUpdate) + '</p>' + (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') + (status ? '<p class="copy-status" role="status">' + esc(status) + '</p>' : '') +
        '<details class="gm-settings"' + (wasOpen ? ' open' : '') + '><summary>GM用の設定</summary><p class="note">候補は個人ごとのおすすめです。7人の配役を確定するものではありません。</p>' + settings + '<button type="button" class="secondary" id="toggleOpen"' + (busy ? ' disabled' : '') + '>' + (room.open ? '回答の受付を終了する' : '回答の受付を再開する') + '</button></details>' + logout + '</section>';
      var su = $('share-url'); su.value = shareUrl; su.addEventListener('focus', function () { su.select(); });
      $('toList').addEventListener('click', function () { room = null; error = ''; status = ''; if (timer) clearInterval(timer); action(loadList); });
      $('copy').addEventListener('click', copy);
      $('refresh').addEventListener('click', function () { action(function () { return openRoom(room.id); }); });
      app.querySelectorAll('.rule').forEach(function (c) { c.addEventListener('change', function () { var k = c.getAttribute('data-k'), i = Number(c.getAttribute('data-i')); var arr = rules.excluded[k]; rules.excluded[k] = arr.indexOf(i) !== -1 ? arr.filter(function (n) { return n !== i; }) : arr.concat([i]); }); });
      if (rules) {
        $('beginner').addEventListener('change', function (e) { rules.beginnerAvoid = e.target.checked; });
        $('intermediate').addEventListener('change', function (e) { rules.intermediatePenalty = e.target.checked; });
        $('saveRules').addEventListener('click', function () { action(async function () { await call({action: 'gmUpdate', id: room.id, rules: rules}); await openRoom(room.id); status = '設定を保存し、おすすめを更新しました。'; }); });
      }
      $('toggleOpen').addEventListener('click', function () { action(async function () { await call({action: 'gmUpdate', id: room.id, open: !room.open}); await openRoom(room.id); }); });
      $('logout').addEventListener('click', doLogout);
    }
    async function loadList() { var d = await call({action: 'gmList'}); list = d.rooms; }
    async function openRoom(id) {
      var d = await call({action: 'gmRoom', id: id});
      room = d; rules = JSON.parse(JSON.stringify(d.rules)); shareUrl = playUrl(id); lastUpdate = new Date().toLocaleTimeString('ja-JP');
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (!room || busy) return;
        call({action: 'gmRoom', id: room.id}).then(function (d2) { if (!room || room.id !== d2.id) return; room = d2; lastUpdate = new Date().toLocaleTimeString('ja-JP'); render(); }).catch(function () {});
      }, 15000);
    }
    async function action(fn) {
      busy = true; error = ''; status = ''; render();
      try { await fn(); } catch (e) { error = e.message || '処理できませんでした。'; }
      finally { busy = false; render(); }
    }
    async function copy() {
      try { await navigator.clipboard.writeText(shareUrl); status = '参加者用URLをコピーしました。'; render(); }
      catch (e) { status = '下の参加者用URLを選択してコピーしてください。'; render(); var s = $('share-url'); s.focus(); s.select(); }
    }
    function doLogout() { var t = token; logoutLocal(); api({action: 'gmLogout', token: t}).catch(function () {}); list = []; error = ''; status = ''; render(); }

    if (token) action(loadList); else render();
  }
  gmPage();
})();
