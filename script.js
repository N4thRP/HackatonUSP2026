/* Vaga Viva · lab de risco, confirmação, reocupação e retorno.
   Todos os dados são fictícios e as taxas são hipóteses. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function num(id, def) {
    var el = $(id);
    if (!el) { return def; }
    var v = parseFloat(String(el.value).replace(',', '.'));
    return isNaN(v) ? def : v;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function fmtInt(n) {
    var s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 && Math.round(Math.abs(n)) > 0 ? '-' : '') + s;
  }
  function fmtBRL(n) { return (n < 0 ? '-R$ ' : 'R$ ') + fmtInt(Math.abs(n)); }
  function fmtPct(x, d) { return (x * 100).toFixed(d === undefined ? 0 : d).replace('.', ',') + '%'; }
  function fmtNum(x, d) { return x.toFixed(d).replace('.', ','); }
  function fmtSign(x, d) { return (x >= 0 ? '+' : '-') + fmtNum(Math.abs(x), d); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function setText(id, t) { var el = $(id); if (el) { el.textContent = t; } }

  /* ---------- 7.1 modelo de risco ---------- */
  var TIPOS = {
    consulta: { label: 'Consulta (primeira vez)', v: 0 },
    retorno: { label: 'Retorno', v: -0.3 },
    exame: { label: 'Exame', v: 0.2 },
    cirurgia: { label: 'Cirurgia', v: -0.9 }
  };
  var CONF = {
    nao: { label: 'Ainda não contatado', v: 0 },
    confirmou: { label: 'Confirmou ativamente', v: -1.2 },
    sem: { label: 'Contatado, sem resposta', v: 1.0 }
  };
  var TRANSP = {
    proprio: { label: 'Meio próprio ou a pé', v: 0 },
    publico: { label: 'Transporte público', v: 0.5 },
    prefeitura: { label: 'Depende de transporte da prefeitura ou de terceiros', v: 0.9 }
  };
  var PRIOR_TAXA = 0.2, PRIOR_FORCA = 2;
  var W_PADRAO = { b0: -3, hist: 3, antec: 0.9, desloc: 0.9, transp: 1, tipo: 1, conf: 1 };

  function pesos() {
    return {
      b0: num('w-b0', W_PADRAO.b0), hist: num('w-hist', W_PADRAO.hist),
      antec: num('w-antec', W_PADRAO.antec), desloc: num('w-desloc', W_PADRAO.desloc),
      transp: num('w-transp', 1), tipo: num('w-tipo', 1), conf: num('w-conf', 1)
    };
  }
  function limiares() {
    var alto = clamp(num('in-alto', 40), 1, 99) / 100;
    var medio = clamp(num('in-medio', 20), 1, 99) / 100;
    if (medio > alto) { medio = alto; }
    return { alto: alto, medio: medio };
  }
  function taxaSuavizada(faltas, total) {
    var f = Math.max(0, faltas), t = Math.max(f, total);
    return (f + PRIOR_TAXA * PRIOR_FORCA) / (t + PRIOR_FORCA);
  }
  /* a: {faltas,total,antec,desloc,transp,tipo,conf}; w: pesos */
  function risco(a, w) {
    var taxa = taxaSuavizada(a.faltas, a.total);
    var fatores = [
      { nome: 'Histórico de faltas', valor: a.faltas + ' de ' + Math.max(a.total, a.faltas) + ' (suavizada ' + fmtPct(taxa) + ')', c: w.hist * taxa },
      { nome: 'Antecedência', valor: a.antec + ' dias', c: w.antec * clamp(a.antec, 0, 60) / 60 },
      { nome: 'Deslocamento', valor: a.desloc + ' min', c: w.desloc * clamp(a.desloc, 0, 180) / 180 },
      { nome: 'Transporte', valor: TRANSP[a.transp].label, c: w.transp * TRANSP[a.transp].v },
      { nome: 'Tipo de atendimento', valor: TIPOS[a.tipo].label, c: w.tipo * TIPOS[a.tipo].v },
      { nome: 'Confirmação', valor: CONF[a.conf].label, c: w.conf * CONF[a.conf].v }
    ];
    var z = w.b0, i;
    for (i = 0; i < fatores.length; i++) { z += fatores[i].c; }
    return { z: z, prob: sigmoid(z), taxa: taxa, fatores: fatores };
  }
  function faixa(prob, lim) {
    if (prob >= lim.alto) { return 'alta'; }
    if (prob >= lim.medio) { return 'media'; }
    return 'baixa';
  }
  var FAIXA_NOME = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

  /* 7.2 plano de contato */
  function plano(fx, transp, hlib) {
    var itens = [];
    if (fx === 'alta') {
      itens.push('D-3: contato ativo (mensagem e, sem resposta, ligação).');
      itens.push('D-1: segunda confirmação, com opção de remarcar em um toque.');
      itens.push('H-' + hlib + ': confirmação final. Sem resposta, o horário entra em pré-oferta à fila.');
    } else if (fx === 'media') {
      itens.push('D-2: confirmação ativa por mensagem.');
      itens.push('H-' + hlib + ': confirmação final.');
    } else {
      itens.push('D-1: lembrete simples com o botão "não vou conseguir ir".');
    }
    if (fx !== 'baixa' && transp !== 'proprio') {
      itens.push('Perguntar se há barreira de transporte e encaminhar ao apoio disponível (módulo futuro, D8).');
    }
    return itens;
  }

  var EXEMPLOS = [
    { hora: '07:30', nome: 'Paciente 01', tipo: 'consulta', faltas: 0, total: 8, antec: 10, desloc: 20, transp: 'proprio', conf: 'nao' },
    { hora: '08:00', nome: 'Paciente 02', tipo: 'retorno', faltas: 1, total: 5, antec: 14, desloc: 45, transp: 'publico', conf: 'confirmou' },
    { hora: '08:30', nome: 'Paciente 03', tipo: 'consulta', faltas: 2, total: 6, antec: 30, desloc: 90, transp: 'prefeitura', conf: 'nao' },
    { hora: '09:00', nome: 'Paciente 04', tipo: 'exame', faltas: 2, total: 5, antec: 40, desloc: 110, transp: 'prefeitura', conf: 'nao' },
    { hora: '09:30', nome: 'Paciente 05', tipo: 'cirurgia', faltas: 0, total: 3, antec: 21, desloc: 60, transp: 'publico', conf: 'confirmou' },
    { hora: '10:00', nome: 'Paciente 06', tipo: 'consulta', faltas: 0, total: 3, antec: 35, desloc: 120, transp: 'prefeitura', conf: 'nao' },
    { hora: '10:30', nome: 'Paciente 07', tipo: 'retorno', faltas: 0, total: 10, antec: 7, desloc: 15, transp: 'proprio', conf: 'confirmou' },
    { hora: '11:00', nome: 'Paciente 08', tipo: 'exame', faltas: 1, total: 4, antec: 25, desloc: 70, transp: 'publico', conf: 'nao' },
    { hora: '11:30', nome: 'Paciente 09', tipo: 'consulta', faltas: 3, total: 7, antec: 45, desloc: 80, transp: 'publico', conf: 'nao' },
    { hora: '13:00', nome: 'Paciente 10', tipo: 'retorno', faltas: 0, total: 4, antec: 12, desloc: 30, transp: 'proprio', conf: 'nao' }
  ];

  function lerAgendamento() {
    return {
      faltas: Math.max(0, num('r-faltas', 0)), total: Math.max(0, num('r-total', 0)),
      antec: Math.max(0, num('r-antec', 0)), desloc: Math.max(0, num('r-desloc', 0)),
      transp: $('r-transp') ? $('r-transp').value : 'proprio',
      tipo: $('r-tipo') ? $('r-tipo').value : 'consulta',
      conf: $('r-conf') ? $('r-conf').value : 'nao'
    };
  }
  function carregarExemplo(i) {
    var e = EXEMPLOS[i];
    if (!e) { return; }
    $('r-faltas').value = e.faltas; $('r-total').value = e.total;
    $('r-antec').value = e.antec; $('r-desloc').value = e.desloc;
    $('r-transp').value = e.transp; $('r-tipo').value = e.tipo; $('r-conf').value = e.conf;
  }

  function renderRisco() {
    var w = pesos(), lim = limiares(), a = lerAgendamento();
    var r = risco(a, w), fx = faixa(r.prob, lim);
    setText('res-prob', fmtPct(r.prob));
    setText('res-faixa', FAIXA_NOME[fx]);
    setText('res-taxa', fmtPct(r.taxa));
    var el = $('res-faixa');
    if (el) { el.className = 'result-num band-' + fx; }

    var html = '<tr><td>Constante (base do modelo)</td><td class="small">-</td><td class="num">' + fmtSign(w.b0, 2) + '</td></tr>', i;
    for (i = 0; i < r.fatores.length; i++) {
      html += '<tr><td>' + esc(r.fatores[i].nome) + '</td><td class="small">' + esc(r.fatores[i].valor) +
        '</td><td class="num">' + fmtSign(r.fatores[i].c, 2) + '</td></tr>';
    }
    html += '<tr><td><strong>Total (z)</strong></td><td class="small">risco = ' + fmtPct(r.prob, 1) + '</td><td class="num"><strong>' + fmtSign(r.z, 2) + '</strong></td></tr>';
    if ($('fat-body')) { $('fat-body').innerHTML = html; }

    var hlib = Math.max(1, Math.round(num('in-hlib', 3)));
    var itens = plano(fx, a.transp, hlib), li = '';
    for (i = 0; i < itens.length; i++) { li += '<li>' + esc(itens[i]) + '</li>'; }
    if ($('plano-lista')) { $('plano-lista').innerHTML = li; }
    setText('plano-intro', 'Faixa ' + FAIXA_NOME[fx].toLowerCase() + ': o contato é mais intenso quanto maior o risco. O sistema orienta o contato e não muda a prioridade clínica (RR1).');
    renderAgenda();
  }

  function renderAgenda() {
    var w = pesos(), lim = limiares(), hlib = Math.max(1, Math.round(num('in-hlib', 3)));
    var linhas = [], i, esperado = 0, altas = 0;
    for (i = 0; i < EXEMPLOS.length; i++) {
      var e = EXEMPLOS[i], r = risco(e, w), fx = faixa(r.prob, lim);
      esperado += r.prob;
      if (fx === 'alta') { altas++; }
      linhas.push({ e: e, r: r, fx: fx });
    }
    linhas.sort(function (x, y) { return y.r.prob - x.r.prob; });
    var html = '';
    for (i = 0; i < linhas.length; i++) {
      var l = linhas[i], acao = plano(l.fx, l.e.transp, hlib)[0];
      html += '<tr><td>' + l.e.hora + '</td><td>' + esc(l.e.nome) + '</td><td>' + esc(TIPOS[l.e.tipo].label) +
        '</td><td class="num">' + fmtPct(l.r.prob) + '</td><td><span class="band-' + l.fx + '">' + FAIXA_NOME[l.fx] +
        '</span></td><td class="small">' + esc(acao) + '</td></tr>';
    }
    if ($('ag-body')) { $('ag-body').innerHTML = html; }
    setText('ag-n', String(EXEMPLOS.length));
    setText('ag-alta', String(altas));
    setText('ag-esp', fmtNum(esperado, 1));
  }

  /* ---------- 7.3 oferta à fila ---------- */
  var FILA = [
    { nome: 'Paciente A', esp: 'Cardiologia', classe: 1, dias: 120, min: 40, acc: 0.7, aut: true },
    { nome: 'Paciente B', esp: 'Cardiologia', classe: 2, dias: 200, min: 150, acc: 0.6, aut: true },
    { nome: 'Paciente C', esp: 'Cardiologia', classe: 2, dias: 310, min: 30, acc: 0.5, aut: false },
    { nome: 'Paciente D', esp: 'Cardiologia', classe: 3, dias: 400, min: 25, acc: 0.4, aut: true },
    { nome: 'Paciente E', esp: 'Cardiologia', classe: 1, dias: 60, min: 90, acc: 0.8, aut: true },
    { nome: 'Paciente F', esp: 'Cardiologia', classe: 3, dias: 90, min: 20, acc: 0.3, aut: false },
    { nome: 'Paciente G', esp: 'Oftalmologia', classe: 2, dias: 250, min: 35, acc: 0.5, aut: true },
    { nome: 'Paciente H', esp: 'Oftalmologia', classe: 1, dias: 40, min: 60, acc: 0.7, aut: true },
    { nome: 'Paciente I', esp: 'Oftalmologia', classe: 3, dias: 500, min: 200, acc: 0.6, aut: false },
    { nome: 'Paciente J', esp: 'Oftalmologia', classe: 2, dias: 150, min: 15, acc: 0.35, aut: true }
  ];

  /* modo: publico|privado. Retorna {linhas, chance, ofertas, primeiro} */
  function ofertar(modo, esp, horas, resp, par) {
    var disp = horas * 60, cand = [], fora = [], i;
    par = Math.max(1, Math.round(par));
    for (i = 0; i < FILA.length; i++) {
      var f = FILA[i];
      if (f.esp !== esp) { continue; }
      if (modo === 'privado' && !f.aut) { fora.push({ f: f, sit: 'Fora: sem autorização do convênio', ok: false }); }
      else { cand.push(f); }
    }
    cand.sort(function (a, b) {
      if (modo === 'publico') {
        if (a.classe !== b.classe) { return a.classe - b.classe; }
        return b.dias - a.dias;
      }
      if (b.dias !== a.dias) { return b.dias - a.dias; }
      return a.classe - b.classe;
    });
    var linhas = [], semFalha = 1, ofertas = 0, primeiro = '-';
    for (i = 0; i < cand.length; i++) {
      var c = cand[i], rodada = Math.floor(i / par), fim = (rodada + 1) * resp;
      var chega = fim + c.min, ok = chega <= disp;
      if (ok) {
        ofertas++; semFalha *= (1 - c.acc);
        if (primeiro === '-') { primeiro = c.nome; }
        linhas.push({ f: c, ok: true, sit: 'Oferta na rodada ' + (rodada + 1) + ' (responde até ' + fim + ' min; chega em ' + chega + ' min)' });
      } else {
        linhas.push({ f: c, ok: false, sit: 'Fora: não chegaria a tempo (' + chega + ' min > ' + Math.round(disp) + ' min)' });
      }
    }
    return { linhas: linhas.concat(fora), chance: ofertas ? 1 - semFalha : 0, ofertas: ofertas, primeiro: primeiro };
  }

  function renderFila() {
    var modo = $('v-modo') ? $('v-modo').value : 'publico';
    var esp = $('v-esp') ? $('v-esp').value : 'Cardiologia';
    var r = ofertar(modo, esp, Math.max(0.5, num('v-horas', 5)), Math.max(1, num('v-resp', 20)), num('v-par', 1));
    setText('v-chance', fmtPct(r.chance));
    setText('v-ofertas', String(r.ofertas));
    setText('v-primeiro', r.primeiro);
    var html = '', i;
    for (i = 0; i < r.linhas.length; i++) {
      var l = r.linhas[i];
      html += '<tr><td>' + esc(l.f.nome) + '</td><td>' + l.f.classe + '</td><td class="num">' + l.f.dias +
        '</td><td class="num">' + l.f.min + '</td><td class="num">' + Math.round(l.f.acc * 100) +
        '</td><td class="small ' + (l.ok ? 'ok' : 'muted') + '">' + esc(l.sit) + '</td></tr>';
    }
    if ($('v-body')) { $('v-body').innerHTML = html; }
    var al = $('v-alerta');
    if (al) {
      if (r.ofertas === 0) {
        al.hidden = false;
        al.textContent = 'Ninguém consegue chegar a tempo: o horário provavelmente não será reocupado. O aviso precisa vir mais cedo, e é isso que a confirmação ativa busca.';
      } else { al.hidden = true; al.textContent = ''; }
    }
  }

  /* ---------- 7.4 retorno financeiro ---------- */
  function simular(p) {
    var faltas = p.agenda * p.falta;
    var evitadas = faltas * p.evit;
    var restantes = faltas - evitadas;
    var reoc = restantes * p.aviso * p.reoc;
    var rec = evitadas + reoc;
    var rev = rec * p.valor;
    var preco = p.fixo + p.fee * rev;
    return {
      faltas: faltas, evitadas: evitadas, reoc: reoc, rec: rec, rev: rev, preco: preco,
      liq: rev - preco, razao: preco > 0 ? rev / preco : 0,
      filaAbs: p.fila > 0 ? Math.min(1, reoc * 12 / p.fila) : 0
    };
  }
  function lerSim() {
    return {
      agenda: Math.max(0, num('s-agenda', 0)),
      falta: clamp(num('s-falta', 0), 0, 100) / 100,
      evit: clamp(num('s-evit', 0), 0, 100) / 100,
      aviso: clamp(num('s-aviso', 0), 0, 100) / 100,
      reoc: clamp(num('s-reoc', 0), 0, 100) / 100,
      valor: Math.max(0, num('s-valor', 0)),
      fixo: Math.max(0, num('s-fixo', 0)),
      fee: clamp(num('s-fee', 0), 0, 100) / 100,
      fila: Math.max(0, num('s-fila', 0))
    };
  }
  var PRESETS = {
    privado: {
      vals: { 's-agenda': 4000, 's-falta': 20, 's-evit': 15, 's-aviso': 50, 's-reoc': 60, 's-valor': 300, 's-fixo': 3000, 's-fee': 8, 's-fila': 5000 },
      nota: 'Privado: o valor por atendimento (R$ 300) vem de um exemplo editorial, não de medição; troque pelo ticket real da especialidade. A taxa de falta de 20% é de fonte comercial.'
    },
    publico: {
      vals: { 's-agenda': 4000, 's-falta': 25, 's-evit': 15, 's-aviso': 50, 's-reoc': 60, 's-valor': 90, 's-fixo': 3000, 's-fee': 0, 's-fila': 5000 },
      nota: 'Público: o valor por atendimento é uma estimativa de produção (hipótese), e o ganho principal é capacidade usada e fila menor, não caixa. Sem parte do recuperado por padrão.'
    }
  };
  function aplicarPreset(nome) {
    var p = PRESETS[nome], k;
    for (k in p.vals) { if (Object.prototype.hasOwnProperty.call(p.vals, k) && $(k)) { $(k).value = p.vals[k]; } }
    setText('s-nota', p.nota);
    renderSim();
  }
  function renderSim() {
    var p = lerSim(), s = simular(p);
    setText('s-faltas', fmtInt(s.faltas));
    setText('s-rec', fmtInt(s.rec));
    setText('s-rev', fmtBRL(s.rev));
    setText('s-preco', fmtBRL(s.preco));
    setText('s-liq', fmtBRL(s.liq));
    setText('s-roi', fmtNum(s.razao, 1) + '×');
    setText('s-fila-abs', fmtPct(s.filaAbs, 1));
    var cen = [['Conservador (efeitos × 0,5)', 0.5], ['Base (efeitos × 1)', 1], ['Otimista (efeitos × 1,4)', 1.4]], html = '', i;
    for (i = 0; i < cen.length; i++) {
      var q = {}, k;
      for (k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) { q[k] = p[k]; } }
      q.evit = clamp(p.evit * cen[i][1], 0, 1); q.aviso = clamp(p.aviso * cen[i][1], 0, 1); q.reoc = clamp(p.reoc * cen[i][1], 0, 1);
      var r = simular(q);
      html += '<tr><td>' + cen[i][0] + '</td><td class="num">' + fmtInt(r.rec) + '</td><td class="num">' + fmtBRL(r.rev) +
        '</td><td class="num">' + fmtBRL(r.liq) + '</td></tr>';
    }
    if ($('s-cen')) { $('s-cen').innerHTML = html; }
  }

  /* ---------- 7.5 dados sintéticos ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function escolher(rnd, opcoes) {
    var x = rnd(), acc = 0, i;
    for (i = 0; i < opcoes.length; i++) { acc += opcoes[i][1]; if (x < acc) { return opcoes[i][0]; } }
    return opcoes[opcoes.length - 1][0];
  }
  function gaussiana(rnd) {
    var u = Math.max(rnd(), 1e-9), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function gerar(n, seed, wModelo, lim) {
    var rnd = mulberry32(seed), dados = [], i, j;
    for (i = 0; i < n; i++) {
      var total = 1 + Math.floor(rnd() * 12), faltas = 0;
      for (j = 0; j < total; j++) { if (rnd() < 0.2) { faltas++; } }
      var a = {
        faltas: faltas, total: total, antec: Math.floor(rnd() * 61), desloc: Math.floor(rnd() * rnd() * 181),
        transp: escolher(rnd, [['proprio', 0.5], ['publico', 0.3], ['prefeitura', 0.2]]),
        tipo: escolher(rnd, [['consulta', 0.4], ['retorno', 0.3], ['exame', 0.2], ['cirurgia', 0.1]]),
        conf: escolher(rnd, [['nao', 0.5], ['confirmou', 0.35], ['sem', 0.15]])
      };
      var real = risco(a, W_PADRAO).z + 0.8 * gaussiana(rnd);
      var prev = risco(a, wModelo).prob;
      dados.push({ prob: prev, falta: rnd() < sigmoid(real) ? 1 : 0, faixa: faixa(prev, lim) });
    }
    return dados;
  }
  function auc(dados) {
    var pos = [], neg = [], i, j, soma = 0;
    for (i = 0; i < dados.length; i++) { (dados[i].falta ? pos : neg).push(dados[i].prob); }
    if (!pos.length || !neg.length) { return null; }
    for (i = 0; i < pos.length; i++) {
      for (j = 0; j < neg.length; j++) {
        if (pos[i] > neg[j]) { soma += 1; } else if (pos[i] === neg[j]) { soma += 0.5; }
      }
    }
    return soma / (pos.length * neg.length);
  }
  function avaliar(dados) {
    var n = dados.length, faltas = 0, i;
    for (i = 0; i < n; i++) { faltas += dados[i].falta; }
    var ord = dados.slice().sort(function (a, b) { return b.prob - a.prob; });
    var k = Math.ceil(n * 0.2), cap = 0;
    for (i = 0; i < k; i++) { cap += ord[i].falta; }
    var por = { alta: [0, 0, 0], media: [0, 0, 0], baixa: [0, 0, 0] };
    for (i = 0; i < n; i++) { var g = por[dados[i].faixa]; g[0]++; g[1] += dados[i].prob; g[2] += dados[i].falta; }
    return {
      n: n, base: n ? faltas / n : 0, auc: auc(dados), top: faltas ? cap / faltas : 0,
      precAlta: por.alta[0] ? por.alta[2] / por.alta[0] : null, por: por
    };
  }
  function renderBacktest() {
    var n = clamp(Math.round(num('b-n', 600)), 100, 5000), seed = Math.max(1, Math.round(num('b-seed', 42)));
    var m = avaliar(gerar(n, seed, pesos(), limiares()));
    setText('b-base', fmtPct(m.base, 1));
    setText('b-auc', m.auc === null ? '-' : fmtNum(m.auc, 2));
    setText('b-top', fmtPct(m.top));
    setText('b-prec', m.precAlta === null ? '-' : fmtPct(m.precAlta));
    var html = '', ks = ['alta', 'media', 'baixa'], i;
    for (i = 0; i < ks.length; i++) {
      var g = m.por[ks[i]];
      html += '<tr><td><span class="band-' + ks[i] + '">' + FAIXA_NOME[ks[i]] + '</span></td><td class="num">' + g[0] +
        '</td><td class="num">' + (g[0] ? fmtPct(g[1] / g[0], 1) : '-') + '</td><td class="num">' + (g[0] ? fmtPct(g[2] / g[0], 1) : '-') + '</td></tr>';
    }
    if ($('b-body')) { $('b-body').innerHTML = html; }
  }

  /* ---------- 10 diário ---------- */
  var STORAGE_KEY = 'vagaviva-diario';
  var BASE_ENTRIES = [
    { when: '07/11/2026 · manhã', tag: 'Intenção', text: 'Início da preparação para o Hackathon USP 2026 (tema: Saúde para todos). Primeira ideia: rotas de unidade móvel de prevenção.' },
    { when: '07/11/2026 · tarde', tag: 'Decisão', text: 'Funil para hemodiálise e transporte; descobrimos obrigação legal municipal de transporte e reavaliamos a novidade.' },
    { when: '07/11/2026 · tarde', tag: 'Descoberta', text: 'O orientador não aprovou a ideia de rotas. Exploramos crédito, direitos e FGTS por diagnóstico; seguradoras descartadas como pagadoras.' },
    { when: '07/11/2026 · 18:10', tag: 'Entrega', text: 'Protótipo Amparo (SaaS de assistência social para hospitais) com lab de vulnerabilidade, direitos, documentos e painel.' },
    { when: '07/11/2026 · 18:20', tag: 'Descoberta', text: 'O orientador rejeitou o Amparo: o interesse do hospital em pagar e o paciente atendido não estavam claros. Novo critério: quem sofre, quem paga e por que paga.' },
    { when: '07/11/2026 · 18:35', tag: 'Pesquisa', text: 'Pesquisa de faltas e cancelamentos no SUS e no privado, e de alternativas (retinopatia, telessaúde, crônicos para empresas).' },
    { when: '07/11/2026 · 18:50', tag: 'Decisão', text: 'Escopo final: prever cancelamento de última hora, confirmar ativamente e reocupar o horário com quem está na fila, para hospitais públicos e privados (D1, D2).' },
    { when: '07/11/2026 · 19:00', tag: 'Entrega', text: 'Documento reorganizado nas dez seções, com lab de risco, plano de confirmação, oferta à fila, retorno financeiro e teste de métricas.' }
  ];

  function lerExtras() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
    } catch (e) { return []; }
  }
  function salvarExtras(arr) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
  }
  function todasEntradas() {
    var extras = lerExtras(), out = [], i;
    for (i = 0; i < BASE_ENTRIES.length; i++) { out.push({ when: BASE_ENTRIES[i].when, tag: BASE_ENTRIES[i].tag, text: BASE_ENTRIES[i].text, added: false }); }
    for (i = 0; i < extras.length; i++) { out.push({ when: extras[i].when, tag: extras[i].tag, text: extras[i].text, added: true }); }
    return out;
  }
  function renderDiario() {
    var list = $('diary-list');
    if (!list) { return; }
    var es = todasEntradas(), html = '', i;
    for (i = 0; i < es.length; i++) {
      html += '<li><span class="when">' + esc(es[i].when) + ' · ' + esc(es[i].tag) + '</span>' +
        (es[i].added ? ' <span class="added">adicionada</span>' : '') + '<p class="what">' + esc(es[i].text) + '</p></li>';
    }
    list.innerHTML = html;
  }
  function agora() {
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function diarioMarkdown() {
    var es = todasEntradas(), out = '# Diário de bordo · Vaga Viva\n\n', i;
    for (i = 0; i < es.length; i++) { out += '- **' + es[i].when + '** [' + es[i].tag + '] ' + es[i].text + '\n'; }
    return out;
  }
  function copiar(texto, msgId) {
    function ok() { setText(msgId, 'Copiado.'); }
    function falha() { setText(msgId, 'Não foi possível copiar. Selecione e copie manualmente.'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(ok, falha);
        return;
      }
    } catch (e) { /* segue para o plano B */ }
    try {
      var ta = document.createElement('textarea');
      ta.value = texto; document.body.appendChild(ta); ta.select();
      var done = document.execCommand('copy');
      document.body.removeChild(ta);
      if (done) { ok(); } else { falha(); }
    } catch (e2) { falha(); }
  }

  /* ---------- inicialização ---------- */
  function ligar(ids, fn) {
    var i, el;
    for (i = 0; i < ids.length; i++) {
      el = $(ids[i]);
      if (el) { el.addEventListener('input', fn); el.addEventListener('change', fn); }
    }
  }
  function iniciar() {
    var sel = $('sel-ag'), i, html = '';
    if (sel) {
      for (i = 0; i < EXEMPLOS.length; i++) {
        html += '<option value="' + i + '">' + EXEMPLOS[i].hora + ' · ' + EXEMPLOS[i].nome + ' · ' + TIPOS[EXEMPLOS[i].tipo].label + '</option>';
      }
      sel.innerHTML = html;
      sel.value = '2';
      sel.addEventListener('change', function () { carregarExemplo(parseInt(sel.value, 10)); renderRisco(); });
    }
    ligar(['r-faltas', 'r-total', 'r-antec', 'r-desloc', 'r-transp', 'r-tipo', 'r-conf',
      'w-b0', 'w-hist', 'w-antec', 'w-desloc', 'w-transp', 'w-tipo', 'w-conf', 'in-alto', 'in-medio', 'in-hlib'], function () { renderRisco(); renderBacktest(); });
    ligar(['v-modo', 'v-esp', 'v-horas', 'v-resp', 'v-par'], renderFila);
    ligar(['s-agenda', 's-falta', 's-evit', 's-aviso', 's-reoc', 's-valor', 's-fixo', 's-fee', 's-fila'], renderSim);

    var b1 = $('btn-preset-priv'), b2 = $('btn-preset-pub'), bt = $('btn-bt');
    if (b1) { b1.addEventListener('click', function () { aplicarPreset('privado'); }); }
    if (b2) { b2.addEventListener('click', function () { aplicarPreset('publico'); }); }
    if (bt) { bt.addEventListener('click', renderBacktest); }

    var form = $('diary-form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var t = $('diary-text'), txt = t ? t.value.replace(/^\s+|\s+$/g, '') : '';
        if (!txt) { return; }
        var extras = lerExtras();
        extras.push({ when: agora(), tag: $('diary-tag').value, text: txt });
        if (!salvarExtras(extras)) { setText('diary-msg', 'Não foi possível salvar neste navegador.'); }
        t.value = ''; renderDiario();
      });
    }
    var bc = $('diary-copy'), br = $('diary-reset');
    if (bc) { bc.addEventListener('click', function () { copiar(diarioMarkdown(), 'diary-msg'); }); }
    if (br) {
      br.addEventListener('click', function () { salvarExtras([]); renderDiario(); setText('diary-msg', 'Entradas adicionadas apagadas.'); });
    }

    carregarExemplo(2);
    aplicarPreset('privado');
    renderRisco();
    renderFila();
    renderBacktest();
    renderDiario();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciar); }
  else { iniciar(); }

  /* exposição mínima para testes */
  window.VagaViva = { risco: risco, faixa: faixa, ofertar: ofertar, simular: simular, avaliar: avaliar, gerar: gerar, pesos: W_PADRAO, taxaSuavizada: taxaSuavizada };
})();