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

  // Municípios fictícios. d: minutos de viagem até o destino (polo regional). km: distância.
  // pac: pacientes hoje. prio: classe de prioridade operacional (fictícia; na vida real vem das
  // equipes de saúde). Critério federal ilustrativo: mais de 50 km do centro de referência.
  var KM_CRITERIO = 50;
  var PRIOS = ['Alta', 'Média', 'Normal'];
  var MUNIS = [
    { id: 'vila',    nome: 'Vila Nova',      curto: 'Vila Nova',    pac: 5, d: 20, km: 15, prio: 'Normal' },
    { id: 'judas',   nome: 'São Judas',      curto: 'São Judas',    pac: 6, d: 35, km: 28, prio: 'Normal' },
    { id: 'esper',   nome: 'Boa Esperança',  curto: 'B. Esperança', pac: 4, d: 55, km: 62, prio: 'Alta' },
    { id: 'ribeira', nome: 'Ribeirão Seco',  curto: 'Rib. Seco',    pac: 5, d: 40, km: 42, prio: 'Média' },
    { id: 'agua',    nome: 'Água Fria',      curto: 'Água Fria',    pac: 3, d: 70, km: 88, prio: 'Alta' },
    { id: 'pedra',   nome: 'Pedra Branca',   curto: 'P. Branca',    pac: 4, d: 65, km: 78, prio: 'Média' }
  ];

  var plan = {}; // id -> { grupo: 'A'|'B'|'', turno: 'Manhã'|'Tarde'|'Noite'|'' }
  var draftOn = false; // o rascunho da pactuação já foi gerado?

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
      cresc: Math.max(0, num('in-cresc', 0)) / 100,
      fator: Math.max(0.5, num('in-fator', 1)),
      peso: Math.min(100, Math.max(0, num('in-peso', 70))) / 100,
      maq: Math.max(1, num('in-maq', 8)),
      assentos: Math.max(1, num('in-assentos', 15)),
      dur: Math.min(4.5, Math.max(3, num('in-dur', 4))) * 60,
      limite: Math.max(1, num('in-limite', 90)),
      saidaMin: parseHora('in-saida', 5 * 60),
      retornoMax: parseHora('in-retorno', 21 * 60 + 30),
      parada: Math.max(0, num('in-parada', 5)),
      reserva: $('in-reserva') ? $('in-reserva').checked : false
    };
  }

  // Município no cenário atual: crescimento da demanda e multiplicador de distância ao destino.
  function efetivo(m, p) {
    return {
      id: m.id, nome: m.nome, curto: m.curto, prio: m.prio,
      pac: Math.round(m.pac * (1 + p.cresc)),
      d: Math.round(m.d * p.fator),
      km: m.km * p.fator
    };
  }

  function rankPrio(prio) {
    var i = PRIOS.indexOf(prio);
    return i < 0 ? PRIOS.length : i;
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
    var bordoMax = 0, pacBordo = 0;
    ord.forEach(function (m, i) {
      var b = m.d + p.parada * (n - 1 - i);
      if (b > bordoMax) bordoMax = b;
      pacBordo += m.pac * b;
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
      pacBordo: pacBordo,
      transMin: SESSOES_SEMANA * 2 * pacBordo, // minutos de translocação dos pacientes por semana
      porVeiculo: Math.ceil(pacientes / veiculos)
    };
  }

  function membrosDoSlot(g, t, exceptId, extra) {
    var out = [];
    var p = premissas();
    MUNIS.forEach(function (m) {
      var a = plan[m.id];
      if (m.id !== exceptId && a && a.grupo === g && a.turno === t) out.push(efetivo(m, p));
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
    var efs = MUNIS.map(function (m) { return efetivo(m, p); });
    // Referências para normalizar as duas parcelas do custo (cada município sozinho no seu turno).
    var refTrans = 0, refVeic = 0;
    efs.forEach(function (m) {
      var r = calculaSlot([m], 'Manhã', p);
      refTrans += r.transMin;
      refVeic += r.minSemana;
    });
    refTrans = refTrans || 1;
    refVeic = refVeic || 1;
    // Prioridade escolhe primeiro; dentro da mesma classe, o mais distante primeiro.
    var ordem = efs.slice().sort(function (a, b) {
      return rankPrio(a.prio) - rankPrio(b.prio) || b.d - a.d;
    });
    ordem.forEach(function (m) {
      var melhor = null;
      slotsEmOrdem().forEach(function (s) {
        var atuais = membrosDoSlot(s.g, s.t, null, null);
        var antes = atuais.length ? calculaSlot(atuais, s.t, p) : null;
        var depois = calculaSlot(atuais.concat([m]), s.t, p);
        if (depois.violacoes.length) return;
        var dTrans = depois.transMin - (antes ? antes.transMin : 0);
        var dVeic = depois.minSemana - (antes ? antes.minSemana : 0);
        var delta = p.peso * (dTrans / refTrans) + (1 - p.peso) * (dVeic / refVeic);
        var usado = atuais.length > 0;
        if (!melhor || delta < melhor.delta - 1e-9 || (Math.abs(delta - melhor.delta) <= 1e-9 && usado && !melhor.usado)) {
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
      var inPac = document.createElement('input');
      inPac.type = 'number';
      inPac.min = '0';
      inPac.max = '40';
      inPac.step = '1';
      inPac.value = String(m.pac);
      inPac.setAttribute('aria-label', 'Pacientes hoje em ' + m.nome);
      inPac.addEventListener('input', function () {
        var v = Number(inPac.value);
        m.pac = isFinite(v) && v >= 0 ? Math.round(v) : 0;
        render();
      });
      tdPac.appendChild(inPac);

      var tdCen = document.createElement('td');
      tdCen.className = 'num';
      tdCen.setAttribute('data-col', 'cenario');

      var tdD = document.createElement('td');
      tdD.className = 'num';
      tdD.setAttribute('data-col', 'dist');

      var tdE = document.createElement('td');
      tdE.setAttribute('data-col', 'elegivel');

      var tdP = document.createElement('td');
      var selP = document.createElement('select');
      selP.setAttribute('aria-label', 'Prioridade de ' + m.nome);
      PRIOS.forEach(function (x) { selP.appendChild(opt(x, x)); });
      selP.value = m.prio;
      selP.addEventListener('change', function () { m.prio = selP.value; render(); });
      tdP.appendChild(selP);

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

      [tdNome, tdPac, tdCen, tdD, tdE, tdP, tdG, tdT, tdS].forEach(function (td) { tr.appendChild(td); });
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
    var totalPac = MUNIS.reduce(function (s, m) { return s + efetivo(m, p).pac; }, 0);

    // Situação de cada município (atribuição).
    MUNIS.forEach(function (m) {
      var a = plan[m.id] || { grupo: '', turno: '' };
      var tr = document.querySelector('tr[data-id="' + m.id + '"]');
      if (!tr) return;
      var e = efetivo(m, p);
      tr.querySelector('[data-col="cenario"]').textContent = String(e.pac);
      tr.querySelector('[data-col="dist"]').textContent = fmt(e.km, 0) + ' km · ' + e.d + ' min';
      var el = tr.querySelector('[data-col="elegivel"]');
      el.textContent = e.km > KM_CRITERIO ? 'Sim' : 'Não';
      el.className = e.km > KM_CRITERIO ? 'ok' : 'muted';
      var sel = tr.querySelectorAll('select');
      sel[0].value = m.prio;
      sel[1].value = a.grupo;
      sel[2].value = a.turno;
      var sit = tr.querySelector('[data-col="situacao"]');
      if (a.grupo && a.turno) { sit.textContent = 'Atribuído'; sit.className = 'ok'; }
      else if (a.grupo || a.turno) { sit.textContent = 'Escolha grupo e turno'; sit.className = 'warn'; }
      else { sit.textContent = 'Sem rota'; sit.className = 'warn'; }
    });

    // Rotas por slot.
    var slotBody = $('slot-body');
    slotBody.innerHTML = '';
    var cobertos = 0, violTotal = 0, bordoGeral = 0, horasSemana = 0, falha = 0;
    var transMinTotal = 0, pacBordoTotal = 0, pacAtribuidos = 0;
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
        transMinTotal += r.transMin;
        pacBordoTotal += r.pacBordo;
        pacAtribuidos += r.pacientes;
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
    $('res-trans').textContent = fmt(transMinTotal / 60);
    $('res-medio').textContent = pacAtribuidos ? fmt(pacBordoTotal / pacAtribuidos, 0) : '0';

    var semRota = MUNIS.filter(function (m) {
      var a = plan[m.id];
      return !(a && a.grupo && a.turno);
    });
    if (semRota.length) {
      semRota.sort(function (a, b) { return rankPrio(a.prio) - rankPrio(b.prio); });
      msgs.unshift('Lacuna de atendimento: ' + semRota.length + ' município(s) sem rota (' +
        semRota.map(function (m) { return m.nome + ', prioridade ' + m.prio; }).join('; ') +
        '). Se a capacidade não cabe, o caminho é ampliar máquinas, turnos ou veículos, e não excluir pacientes.');
    }
    var alertEl = $('lab-alert');
    if (msgs.length) { alertEl.textContent = msgs.join(' '); alertEl.hidden = false; }
    else { alertEl.textContent = ''; alertEl.hidden = true; }

    if (draftOn) renderDraft();
  }

  // ---------- Rascunho da pactuação (ilustrativo) ----------
  // Campos baseados nas orientações do COSEMS-SP para a Portaria GM/MS 11.165/2026:
  // gestor da frota, total de pessoas (com acompanhantes), itinerários e abrangência,
  // e articulação com o agendamento. O documento oficial segue o formato da CIR/CIB.
  function pctAcomp() {
    return Math.max(0, Math.min(100, num('in-acomp', 10))) / 100;
  }

  function gestorNome() {
    var el = $('in-gestor');
    var v = el ? el.value.trim() : '';
    return v || 'A definir pela CIR';
  }

  function destinoNome() {
    var el = $('in-destino');
    var v = el ? el.value.trim() : '';
    return v || 'Centro de diálise';
  }

  function linhasRascunho() {
    var p = premissas();
    var pa = pctAcomp();
    var linhas = [];
    GRUPOS.forEach(function (g) {
      TURNOS.forEach(function (t) {
        var membros = membrosDoSlot(g.id, t.id, null, null);
        if (!membros.length) return;
        var r = calculaSlot(membros, t.id, p);
        var nomes = r.membros.map(function (m) { return m.nome; });
        var elegiveis = r.membros
          .filter(function (m) { return m.km > KM_CRITERIO; })
          .reduce(function (s, m) { return s + m.pac; }, 0);
        var acomp = Math.ceil(r.pacientes * pa);
        linhas.push({
          rota: g.rotulo + ' · ' + t.id,
          municipios: nomes.join(', '),
          itinerario: nomes.concat([destinoNome()]).join(' → '),
          prioridade: r.membros.map(function (m) { return m.curto + ': ' + m.prio; }).join('; '),
          pacientes: r.pacientes,
          acomp: acomp,
          total: r.pacientes + acomp,
          elegiveis: elegiveis,
          veiculos: r.veiculos,
          agenda: g.rotulo + ', turno ' + t.id + ' (sessão ' + hhmm(t.inicio) + '–' + hhmm(t.inicio + p.dur) +
            '); saída ' + hhmm(r.saida) + '; chegada em casa ' + hhmm(r.retorno),
          ok: r.violacoes.length === 0,
          violacoes: r.violacoes
        });
      });
    });
    return linhas;
  }

  function rascunhoMarkdown() {
    var linhas = linhasRascunho();
    var gestor = gestorNome();
    var out = ['# Rascunho de pactuação do transporte sanitário (ilustrativo)', '',
      'Gerado pelo RotaSaúde com dados fictícios. O documento oficial segue o formato definido pela CIR/CIB.', '',
      '| Rota | Gestor da frota | Municípios abrangidos | Itinerário | Prioridade | Pacientes + acompanhantes | Elegíveis (>' + KM_CRITERIO + ' km) | Veículos | Articulação com o agendamento | Situação |',
      '|---|---|---|---|---|---|---|---|---|---|'];
    linhas.forEach(function (l) {
      out.push('| ' + [l.rota, gestor, l.municipios, l.itinerario, l.prioridade,
        l.pacientes + ' + ' + l.acomp + ' = ' + l.total, l.elegiveis, l.veiculos, l.agenda,
        l.ok ? 'Sem violações' : 'Revisar: ' + l.violacoes.join('; ')].join(' | ') + ' |');
    });
    return out.join('\n') + '\n';
  }

  function renderDraft() {
    var box = $('draft-out');
    if (!box) return;
    box.innerHTML = '';
    var linhas = linhasRascunho();

    if (!linhas.length) {
      var vazio = document.createElement('p');
      vazio.className = 'muted';
      vazio.textContent = 'Nenhuma rota atribuída ainda. Escolha grupo e turno dos municípios acima.';
      box.appendChild(vazio);
      return;
    }

    var gestor = gestorNome();
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    var table = document.createElement('table');
    table.className = 'draft-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['Rota', 'Gestor da frota', 'Municípios abrangidos', 'Itinerário', 'Prioridade', 'Pacientes + acompanhantes',
      'Elegíveis (>' + KM_CRITERIO + ' km)', 'Veículos', 'Articulação com o agendamento', 'Situação'
    ].forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var totPac = 0, totAcomp = 0, totEleg = 0, avisos = 0;
    linhas.forEach(function (l) {
      var tr = document.createElement('tr');
      tr.appendChild(td(l.rota));
      tr.appendChild(td(gestor));
      tr.appendChild(td(l.municipios));
      tr.appendChild(td(l.itinerario));
      tr.appendChild(td(l.prioridade));
      tr.appendChild(td(l.pacientes + ' + ' + l.acomp + ' = ' + l.total, 'num'));
      tr.appendChild(td(String(l.elegiveis), 'num'));
      tr.appendChild(td(String(l.veiculos), 'num'));
      tr.appendChild(td(l.agenda));
      tr.appendChild(td(l.ok ? 'Sem violações' : 'Revisar: ' + l.violacoes.join('; '), l.ok ? 'ok' : 'warn'));
      tbody.appendChild(tr);
      totPac += l.pacientes; totAcomp += l.acomp; totEleg += l.elegiveis;
      if (!l.ok) avisos++;
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    var resumo = document.createElement('p');
    resumo.textContent = 'Total a transportar: ' + totPac + ' pacientes + ' + totAcomp +
      ' acompanhantes = ' + (totPac + totAcomp) + ' pessoas. Pacientes de municípios a mais de ' +
      KM_CRITERIO + ' km: ' + totEleg + ' de ' + totPac + '.';
    box.appendChild(resumo);

    var semRota = MUNIS.filter(function (m) {
      var a = plan[m.id];
      return !(a && a.grupo && a.turno);
    });
    if (semRota.length) {
      var p1 = document.createElement('p');
      p1.className = 'warn';
      p1.textContent = 'Municípios ainda sem rota: ' + semRota.map(function (m) { return m.nome; }).join(', ') + '.';
      box.appendChild(p1);
    }
    if (avisos) {
      var p2 = document.createElement('p');
      p2.className = 'warn';
      p2.textContent = avisos + ' rota(s) com violação de restrição. Revise o arranjo antes de usar este rascunho.';
      box.appendChild(p2);
    }
    var nota = document.createElement('p');
    nota.className = 'small';
    nota.textContent = 'Rascunho ilustrativo, gerado com dados fictícios. O formato oficial é definido pela CIR e pela CIB do estado.';
    box.appendChild(nota);
  }

  function initDraft() {
    if (!$('btn-draft')) return;
    $('btn-draft').addEventListener('click', function () {
      draftOn = true;
      renderDraft();
    });
    $('draft-copy').addEventListener('click', function () {
      var msg = $('draft-msg');
      if (!linhasRascunho().length) { msg.textContent = 'Não há rotas atribuídas para copiar.'; return; }
      copyText(rascunhoMarkdown()).then(
        function () { msg.textContent = 'Rascunho copiado como Markdown.'; },
        function () { msg.textContent = 'Não foi possível copiar automaticamente.'; }
      );
    });
    ['in-acomp', 'in-gestor', 'in-destino'].forEach(function (id) {
      $(id).addEventListener('input', function () { if (draftOn) renderDraft(); });
    });
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
    initDraft();
    ['in-cresc', 'in-fator', 'in-peso', 'in-maq', 'in-assentos', 'in-dur', 'in-limite', 'in-saida', 'in-retorno', 'in-parada', 'in-reserva']
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
      texto: 'Documento reestruturado para a hemodiálise, mantendo as 10 seções. O lab de UI passou a ser um quadro de turnos e rotas de transporte, com agrupamento guloso e comparação com o arranjo atual.' },
    { quando: '07/11/2026 14:22', tag: 'Descoberta',
      texto: 'O time apontou que já existe lei sobre transporte para hemodiálise. Verificado: Lei 15.233/2025 (pacientes a mais de 50 km), Portaria GM/MS 11.165/2026 com veículos e financiamento, e pactuação por macrorregião (CIR e CIB). Correção: o financiamento federal deixou de ser tratado como minuta. Risco de redundância reconhecido: o projeto não oferece o transporte, ele apoia o desenho dos arranjos.' },
    { quando: '07/11/2026 14:30', tag: 'Pesquisa',
      texto: 'Entendida a pactuação: acordo entre gestores (CIR e CIB) sobre a gestão e o uso da frota. Conteúdo mínimo descrito: gestor da frota, total de pessoas com acompanhantes, itinerários e abrangência, e articulação com o agendamento. Fonte: orientações do COSEMS-SP, a confirmar no texto oficial e no estado escolhido.' },
    { quando: '07/11/2026 14:33', tag: 'Decisão',
      texto: 'Direção provisória: ferramenta de apoio à pactuação macrorregional como moldura, com o compartilhamento de turnos como diferencial. Roteiro de apresentação de 5 minutos esboçado, com demonstração em 6 cliques.' },
    { quando: '07/11/2026 14:39', tag: 'Entrega',
      texto: 'Protótipo atualizado: padrão de 15 assentos, distância em km com o critério de mais de 50 km e botão que gera o rascunho da pactuação a partir do arranjo. Objetivos, requisitos e decisões do documento ainda não foram revisados para esse foco.' },
    { quando: '07/11/2026 14:53', tag: 'Intenção',
      texto: 'Novo enquadramento: o time passa a ser uma empresa que desenvolve um sistema de rotas e agendamentos para frotas que levam pessoas em hemodiálise às capitais. Foco em demanda, prioridade e menor tempo de translocação, com abertura conceitual para outras rotas, como o transporte de órgãos.' },
    { quando: '07/11/2026 14:58', tag: 'Pesquisa',
      texto: 'Transporte de órgãos: o tempo (isquemia fria) é a restrição dominante, o modal aéreo é frequente e há dissertações brasileiras de otimização do tema. É um problema de outra natureza (pontual, urgente, com coordenação própria), então fica como abertura futura, sem entrar no escopo.' },
    { quando: '07/11/2026 15:05', tag: 'Decisão',
      texto: 'Decididos D16 a D21: produto B2G (hipótese), objetivo principal de menor tempo de translocação, prioridade que ordena e nunca exclui, destino como parâmetro (capital ou polo), órgãos como abertura futura e ferramenta de apoio à pactuação como moldura.' },
    { quando: '07/11/2026 15:10', tag: 'Entrega',
      texto: 'Documento reorganizado como material de produto, mantendo as 10 seções. Lab com crescimento da demanda, multiplicador de distância, prioridade por município, peso do tempo do paciente e métricas de translocação (M1, M2). Clientes e modelo de negócio seguem como hipóteses a validar.' }
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