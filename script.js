/* RotaSaúde · Lab de UI (turnos e rotas de transporte) e Diário de bordo.
   Todos os municípios, pacientes e tempos do laboratório são fictícios e ilustrativos. */

(function () {
  'use strict';

  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Grupos de dias de sessão (três sessões por semana).
  var GRUPOS = [
    { id: 'A', rotulo: 'Seg·Qua·Sex', dias: ['Seg', 'Qua', 'Sex'] },
    { id: 'B', rotulo: 'Ter·Qui·Sáb', dias: ['Ter', 'Qui', 'Sáb'] }
  ];

  // Turnos: início em minutos desde 00:00.
  var TURNOS = [
    { id: 'Manhã', inicio: 6 * 60 + 30 },
    { id: 'Tarde', inicio: 11 * 60 + 30 },
    { id: 'Noite', inicio: 16 * 60 + 30 }
  ];

  var FOLGA = 15;          // minutos de antecedência na chegada e de espera na saída
  var SESSOES_SEMANA = 3;  // viagens (ida e volta) por semana de cada paciente

  // Municípios fictícios. d: minutos de viagem até o centro. pac: pacientes.
  var MUNIS = [
    { id: 'vila',    nome: 'Vila Nova',      curto: 'Vila Nova',   pac: 5, d: 20 },
    { id: 'judas',   nome: 'São Judas',      curto: 'São Judas',   pac: 6, d: 35 },
    { id: 'esper',   nome: 'Boa Esperança',  curto: 'B. Esperança', pac: 4, d: 55 },
    { id: 'ribeira', nome: 'Ribeirão Seco',  curto: 'Rib. Seco',   pac: 5, d: 40 },
    { id: 'agua',    nome: 'Água Fria',      curto: 'Água Fria',   pac: 3, d: 70 },
    { id: 'pedra',   nome: 'Pedra Branca',   curto: 'P. Branca',   pac: 4, d: 65 }
  ];

  var plan = {}; // id -> { grupo: 'A'|'B'|'', turno: 'Manhã'|'Tarde'|'Noite'|'' }

  function $(id) { return document.getElementById(id); }
  function num(id, fallback) {
    var el = $(id);
    var v = el ? Number(el.value) : NaN;
    return isFinite(v) ? v : fallback;
  }
  function hhmm(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), r = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (r < 10 ? '0' : '') + r;
  }
  function parseHora(id, fallbackMin) {
    var el = $(id);
    if (!el || !el.value) return fallbackMin;
    var parts = el.value.split(':');
    var h = Number(parts[0]), m = Number(parts[1]);
    return isFinite(h) && isFinite(m) ? h * 60 + m : fallbackMin;
  }
  function fmt(n, d) { return n.toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function turnoDe(id) {
    for (var i = 0; i < TURNOS.length; i++) if (TURNOS[i].id === id) return TURNOS[i];
    return null;
  }
  function slotKey(g, t) { return g + '|' + t; }

  function premissas() {
    return {
      maq: Math.max(1, num('in-maq', 8)),
      assentos: Math.max(1, num('in-assentos', 8)),
      dur: Math.min(4.5, Math.max(3, num('in-dur', 4))) * 60,
      limite: Math.max(1, num('in-limite', 90)),
      saidaMin: parseHora('in-saida', 5 * 60),
      retornoMax: parseHora('in-retorno', 21 * 60 + 30),
      parada: Math.max(0, num('in-parada', 5)),
      reserva: $('in-reserva') ? $('in-reserva').checked : false
    };
  }

  // Calcula uma rota (slot) para um conjunto de municípios no mesmo grupo e turno.
  function calculaSlot(membros, turnoId, p) {
    if (!membros.length) return null;
    var turno = turnoDe(turnoId);
    var ord = membros.slice().sort(function (a, b) { return b.d - a.d; });
    var n = ord.length;
    var pacientes = ord.reduce(function (s, m) { return s + m.pac; }, 0);
    var veiculos = Math.ceil(pacientes / p.assentos);

    // Tempo a bordo de cada paciente: distância + paradas feitas depois do embarque dele.
    var bordoMax = 0;
    ord.forEach(function (m, i) {
      var b = m.d + p.parada * (n - 1 - i);
      if (b > bordoMax) bordoMax = b;
    });
    var viagemMaisLonga = ord[0].d + p.parada * (n - 1);

    var saida = turno.inicio - FOLGA - viagemMaisLonga;
    var retorno = turno.inicio + p.dur + FOLGA + viagemMaisLonga;

    var viol = [];
    if (pacientes > p.maq) viol.push('Pacientes acima das máquinas do turno');
    if (saida < p.saidaMin) viol.push('Saída de casa antes do limite');
    if (retorno > p.retornoMax) viol.push('Chegada em casa depois do limite');
    if (bordoMax > p.limite) viol.push('Tempo a bordo acima do limite');

    return {
      membros: ord,
      pacientes: pacientes,
      veiculos: veiculos,
      saida: saida,
      retorno: retorno,
      bordoMax: bordoMax,
      violacoes: viol,
      minSemana: SESSOES_SEMANA * veiculos * 2 * viagemMaisLonga,
      porVeiculo: Math.ceil(pacientes / veiculos)
    };
  }

  function membrosDoSlot(g, t, exceptId, extra) {
    var out = [];
    MUNIS.forEach(function (m) {
      var a = plan[m.id];
      if (m.id !== exceptId && a && a.grupo === g && a.turno === t) out.push(m);
    });
    if (extra) out.push(extra);
    return out;
  }

  // ---------- Planos ----------
  function limpar() {
    plan = {};
    MUNIS.forEach(function (m) { plan[m.id] = { grupo: '', turno: '' }; });
  }

  function slotsEmOrdem() {
    var lista = [];
    GRUPOS.forEach(function (g) {
      TURNOS.forEach(function (t) { lista.push({ g: g.id, t: t.id }); });
    });
    return lista;
  }

  function planoIngenuo() {
    limpar();
    var slots = slotsEmOrdem();
    MUNIS.forEach(function (m, i) {
      if (i < slots.length) plan[m.id] = { grupo: slots[i].g, turno: slots[i].t };
    });
  }

  function planoGuloso() {
    var p = premissas();
    limpar();
    var ordem = MUNIS.slice().sort(function (a, b) { return b.d - a.d; });
    ordem.forEach(function (m) {
      var melhor = null;
      slotsEmOrdem().forEach(function (s, idx) {
        var atuais = membrosDoSlot(s.g, s.t, null, null);
        var antes = atuais.length ? calculaSlot(atuais, s.t, p) : null;
        var depois = calculaSlot(atuais.concat([m]), s.t, p);
        if (depois.violacoes.length) return;
        var delta = depois.minSemana - (antes ? antes.minSemana : 0);
        var usado = atuais.length > 0;
        if (!melhor || delta < melhor.delta || (delta === melhor.delta && usado && !melhor.usado)) {
          melhor = { g: s.g, t: s.t, delta: delta, usado: usado };
        }
      });
      if (melhor) plan[m.id] = { grupo: melhor.g, turno: melhor.t };
    });
  }

  // ---------- Renderização ----------
  function opt(value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
  }

  function buildTable() {
    var body = $('lab-body');
    if (!body) return;
    body.innerHTML = '';
    MUNIS.forEach(function (m) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', m.id);

      var tdNome = document.createElement('td');
      tdNome.textContent = m.nome;

      var tdPac = document.createElement('td');
      tdPac.className = 'num';
      tdPac.textContent = m.pac;

      var tdD = document.createElement('td');
      tdD.className = 'num';
      tdD.textContent = m.d + ' min';

      var tdG = document.createElement('td');
      var selG = document.createElement('select');
      selG.setAttribute('aria-label', 'Grupo de dias de ' + m.nome);
      selG.appendChild(opt('', '—'));
      GRUPOS.forEach(function (g) { selG.appendChild(opt(g.id, g.rotulo)); });
      selG.addEventListener('change', function () { plan[m.id].grupo = selG.value; render(); });
      tdG.appendChild(selG);

      var tdT = document.createElement('td');
      var selT = document.createElement('select');
      selT.setAttribute('aria-label', 'Turno de ' + m.nome);
      selT.appendChild(opt('', '—'));
      TURNOS.forEach(function (t) { selT.appendChild(opt(t.id, t.id)); });
      selT.addEventListener('change', function () { plan[m.id].turno = selT.value; render(); });
      tdT.appendChild(selT);

      var tdS = document.createElement('td');
      tdS.setAttribute('data-col', 'situacao');

      [tdNome, tdPac, tdD, tdG, tdT, tdS].forEach(function (td) { tr.appendChild(td); });
      body.appendChild(tr);
    });
  }

  function buildBoardHeader() {
    var table = $('board');
    if (!table) return;
    var headRow = table.querySelector('thead tr');
    headRow.innerHTML = '';
    var corner = document.createElement('th');
    corner.textContent = 'Turno';
    headRow.appendChild(corner);
    DIAS.forEach(function (d) {
      var th = document.createElement('th');
      th.textContent = d;
      headRow.appendChild(th);
    });
  }

  function td(text, cls) {
    var c = document.createElement('td');
    c.textContent = text;
    if (cls) c.className = cls;
    return c;
  }

  function render() {
    var p = premissas();
    var totalPac = MUNIS.reduce(function (s, m) { return s + m.pac; }, 0);

    // Situação de cada município (atribuição).
    MUNIS.forEach(function (m) {
      var a = plan[m.id] || { grupo: '', turno: '' };
      var tr = document.querySelector('tr[data-id="' + m.id + '"]');
      if (!tr) return;
      var sel = tr.querySelectorAll('select');
      sel[0].value = a.grupo;
      sel[1].value = a.turno;
      var sit = tr.querySelector('[data-col="situacao"]');
      if (a.grupo && a.turno) { sit.textContent = 'Atribuído'; sit.className = 'ok'; }
      else if (a.grupo || a.turno) { sit.textContent = 'Escolha grupo e turno'; sit.className = 'warn'; }
      else { sit.textContent = 'Sem rota'; sit.className = 'warn'; }
    });

    // Rotas por slot.
    var slotBody = $('slot-body');
    slotBody.innerHTML = '';
    var cobertos = 0, violTotal = 0, bordoGeral = 0, horasSemana = 0, falha = 0;
    var frotaPorTurno = {};
    var quadro = {}; // slotKey -> {nomes, ok}
    var msgs = [];

    GRUPOS.forEach(function (g) {
      TURNOS.forEach(function (t) {
        var membros = membrosDoSlot(g.id, t.id, null, null);
        var tr = document.createElement('tr');
        tr.appendChild(td(g.rotulo + ' · ' + t.id));
        if (!membros.length) {
          tr.appendChild(td('—', 'muted'));
          for (var i = 0; i < 6; i++) tr.appendChild(td('—', 'muted'));
          slotBody.appendChild(tr);
          return;
        }
        var r = calculaSlot(membros, t.id, p);
        var ok = r.violacoes.length === 0;
        tr.appendChild(td(r.membros.map(function (m) { return m.curto; }).join(' → ')));
        tr.appendChild(td(r.pacientes + ' / ' + p.maq, 'num' + (r.pacientes > p.maq ? ' warn' : '')));
        tr.appendChild(td(String(r.veiculos), 'num'));
        tr.appendChild(td(hhmm(r.saida), 'num' + (r.saida < p.saidaMin ? ' warn' : '')));
        tr.appendChild(td(hhmm(r.retorno), 'num' + (r.retorno > p.retornoMax ? ' warn' : '')));
        tr.appendChild(td(fmt(r.bordoMax, 0) + ' min', 'num' + (r.bordoMax > p.limite ? ' warn' : '')));
        tr.appendChild(td(ok ? 'Sem violações' : r.violacoes.join('; '), ok ? 'ok' : 'warn'));
        slotBody.appendChild(tr);

        if (ok) cobertos += r.pacientes;
        violTotal += r.violacoes.length;
        if (r.bordoMax > bordoGeral) bordoGeral = r.bordoMax;
        horasSemana += r.minSemana / 60;
        if (r.porVeiculo > falha) falha = r.porVeiculo;
        frotaPorTurno[t.id] = Math.max(frotaPorTurno[t.id] || 0, r.veiculos);

        var dias = g.dias;
        dias.forEach(function (d) {
          quadro[d + '|' + t.id] = {
            nomes: r.membros.map(function (m) { return m.curto; }).join(' + '),
            ok: ok
          };
        });
        if (!ok) msgs.push(g.rotulo + ' · ' + t.id + ': ' + r.violacoes.join('; ') + '.');
      });
    });

    var frota = 0;
    Object.keys(frotaPorTurno).forEach(function (k) { frota += frotaPorTurno[k]; });
    if (p.reserva && frota > 0) frota += 1;
    var falhaEfetiva = p.reserva ? 0 : falha;

    // Quadro semanal.
    var tbody = document.querySelector('#board tbody');
    tbody.innerHTML = '';
    TURNOS.forEach(function (t) {
      var tr = document.createElement('tr');
      tr.appendChild(td(t.id));
      DIAS.forEach(function (d) {
        var q = quadro[d + '|' + t.id];
        if (!q) tr.appendChild(td('—', 'slot-empty'));
        else tr.appendChild(td(q.nomes, q.ok ? 'slot-used' : 'slot-conflict'));
      });
      tbody.appendChild(tr);
    });

    $('res-cobertura').textContent = cobertos + ' de ' + totalPac;
    $('res-frota').textContent = String(frota);
    $('res-horas').textContent = fmt(horasSemana);
    $('res-bordo').textContent = fmt(bordoGeral, 0);
    $('res-viol').textContent = String(violTotal);
    $('res-falha').textContent = String(falhaEfetiva);

    var semRota = MUNIS.filter(function (m) {
      var a = plan[m.id];
      return !(a && a.grupo && a.turno);
    });
    if (semRota.length) {
      msgs.unshift(semRota.length + ' município(s) sem rota: ' + semRota.map(function (m) { return m.nome; }).join(', ') + '.');
    }
    var alertEl = $('lab-alert');
    if (msgs.length) { alertEl.textContent = msgs.join(' '); alertEl.hidden = false; }
    else { alertEl.textContent = ''; alertEl.hidden = true; }
  }

  function initLab() {
    if (!$('lab-body')) return;
    buildTable();
    buildBoardHeader();
    planoIngenuo();
    render();

    $('btn-naive').addEventListener('click', function () { planoIngenuo(); render(); });
    $('btn-greedy').addEventListener('click', function () { planoGuloso(); render(); });
    $('btn-clear').addEventListener('click', function () { limpar(); render(); });
    ['in-maq', 'in-assentos', 'in-dur', 'in-limite', 'in-saida', 'in-retorno', 'in-parada', 'in-reserva']
      .forEach(function (id) {
        $(id).addEventListener('input', render);
        $(id).addEventListener('change', render);
      });
  }

  // ---------- Diário de bordo ----------
  var STORAGE_KEY = 'rotasaude-diario';

  var BASE_ENTRIES = [
    { quando: '07/11/2026 09:59', tag: 'Intenção',
      texto: 'Primeira pergunta: como se preparar para o Hackathon da USP. Resultado: checklist geral (time, ferramentas, MVP, pitch).' },
    { quando: '07/11/2026 12:01', tag: 'Descoberta',
      texto: 'Tema do desafio recebido pelo slide: "Saúde para todos: soluções para reduzir barreiras no acesso à saúde". O foco do evento é criar um modelo.' },
    { quando: '07/11/2026 12:11', tag: 'Pesquisa',
      texto: 'Levantamento de públicos e problemas com potencial para um modelo: faltas em consultas, desertos de saúde, doenças crônicas, triagem, letramento em saúde, acessibilidade e previsão de demanda.' },
    { quando: '07/11/2026 12:14', tag: 'Pesquisa',
      texto: 'Aprofundada a ideia de "desertos de saúde": índice de acesso (2SFCA), modelo de necessidade (internações evitáveis) e otimização de localização.' },
    { quando: '07/11/2026 12:19', tag: 'Decisão',
      texto: 'Primeiro foco: no interior, novas unidades fixas são inviáveis e parte da população não procura o serviço. Decididos na época: unidade móvel, medicina preventiva e roteamento com prêmios (D1, D2, D3, depois substituídas).' },
    { quando: '07/11/2026 12:33', tag: 'Entrega',
      texto: 'Primeira versão do site (index.html, style.css, script.js) formalizando a proposta da unidade móvel. Os arquivos do repositório estavam vazios.' },
    { quando: '07/11/2026 12:45', tag: 'Workflow',
      texto: 'Orientação para publicar o site via GitHub Pages. Pendente: permissão de escrita para enviar os arquivos ao repositório.' },
    { quando: '07/11/2026 13:00', tag: 'Decisão',
      texto: 'Documento reorganizado em intenção, dores, pesquisa, objetivos, requisitos, métricas, lab de UI, decisões, workflow e diário. Problema central da época: onde e quando disponibilizar as rotas móveis.' },
    { quando: '07/11/2026 13:56', tag: 'Decisão',
      texto: 'Tema afunilado para hemodiálise no interior, com foco na disponibilidade de rotas de transporte. Decididos: D10 (foco), D11 (levar o paciente ao centro), D12 (roteamento periódico com janelas de tempo), D14 (apoio logístico, não clínico). D1 a D4 ficaram como histórico.' },
    { quando: '07/11/2026 13:56', tag: 'Pesquisa',
      texto: 'Fatos de base verificados em fontes: rotina de cerca de três sessões semanais de três a quatro horas, Censo Brasileiro de Diálise 2023, distância média de cerca de 101 km na Bahia (dado antigo) e a Nota Técnica 011/2026 do COSEMS-SC sobre uma minuta de portaria de transporte sanitário (acima de 50 km). Perguntas Q1 a Q10 abertas.' },
    { quando: '07/11/2026 13:56', tag: 'Entrega',
      texto: 'Documento reestruturado para a hemodiálise, mantendo as 10 seções. O lab de UI passou a ser um quadro de turnos e rotas de transporte, com agrupamento guloso e comparação com o arranjo atual.' }
  ];

  function lerExtras() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function gravarExtras(arr) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  function agora() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function renderDiary() {
    var list = $('diary-list');
    if (!list) return;
    list.innerHTML = '';
    BASE_ENTRIES.concat(lerExtras()).forEach(function (e, i) {
      var li = document.createElement('li');
      var when = document.createElement('div');
      when.className = 'when';
      when.textContent = e.quando + ' · ' + e.tag;
      if (i >= BASE_ENTRIES.length) {
        var added = document.createElement('span');
        added.className = 'added';
        added.textContent = 'adicionada';
        when.appendChild(added);
      }
      var what = document.createElement('p');
      what.className = 'what';
      what.textContent = e.texto;
      li.appendChild(when);
      li.appendChild(what);
      list.appendChild(li);
    });
  }

  function diaryMarkdown() {
    var linhas = ['# Diário de bordo · RotaSaúde (Hackathon USP 2026)', ''];
    BASE_ENTRIES.concat(lerExtras()).forEach(function (e) {
      linhas.push('- **' + e.quando + ' · ' + e.tag + '** — ' + e.texto);
    });
    return linhas.join('\n') + '\n';
  }

  function say(msg) {
    var el = $('diary-msg');
    if (el) el.textContent = msg;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); }
      catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function initDiary() {
    if (!$('diary-list')) return;
    renderDiary();

    $('diary-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var texto = $('diary-text').value.trim();
      if (!texto) return;
      var extras = lerExtras();
      extras.push({ quando: agora(), tag: $('diary-tag').value, texto: texto });
      var ok = gravarExtras(extras);
      $('diary-text').value = '';
      renderDiary();
      say(ok ? 'Entrada adicionada (salva neste navegador).' : 'Entrada adicionada, mas o navegador não permitiu salvá-la.');
    });

    $('diary-copy').addEventListener('click', function () {
      copyText(diaryMarkdown()).then(
        function () { say('Diário copiado como Markdown.'); },
        function () { say('Não foi possível copiar automaticamente.'); }
      );
    });

    $('diary-reset').addEventListener('click', function () {
      gravarExtras([]);
      renderDiary();
      say('Entradas adicionadas foram apagadas.');
    });
  }

  initLab();
  initDiary();
})();