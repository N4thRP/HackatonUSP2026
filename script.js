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

  /* ---------- 7.3 motor de reoferta ---------- */
  var URG_NOME = { 1: '1 · Urgente', 2: '2 · Prioritário', 3: '3 · Eletivo' };
  /* origem: 'fila' (sem data) ou 'agendado' (consulta futura em 'futura' dias). hab: hora habitual.
     canc/total: cancelamentos e agendamentos em 12 meses. resp: taxa de resposta a mensagens. */
  var CANDIDATOS = [
    { nome: 'Ana', esp: 'Cardiologia', urg: 1, origem: 'fila', dias: 95, hab: 9, canc: 0, total: 3, min: 35, resp: 0.8, aut: true },
    { nome: 'Bruno', esp: 'Cardiologia', urg: 1, origem: 'agendado', futura: 25, dias: 40, hab: 14, canc: 2, total: 5, min: 50, resp: 0.6, aut: true },
    { nome: 'Carla', esp: 'Cardiologia', urg: 1, origem: 'fila', dias: 130, hab: 15, canc: 0, total: 6, min: 170, resp: 0.9, aut: true },
    { nome: 'Davi', esp: 'Cardiologia', urg: 2, origem: 'agendado', futura: 60, dias: 30, hab: 14, canc: 0, total: 4, min: 20, resp: 0.9, aut: true },
    { nome: 'Elisa', esp: 'Cardiologia', urg: 2, origem: 'fila', dias: 210, hab: 8, canc: 1, total: 2, min: 60, resp: 0.5, aut: false },
    { nome: 'Fábio', esp: 'Cardiologia', urg: 2, origem: 'agendado', futura: 15, dias: 70, hab: 13, canc: 3, total: 6, min: 30, resp: 0.7, aut: true },
    { nome: 'Gisele', esp: 'Cardiologia', urg: 3, origem: 'fila', dias: 320, hab: 14, canc: 0, total: 5, min: 15, resp: 0.95, aut: true },
    { nome: 'Hugo', esp: 'Cardiologia', urg: 3, origem: 'agendado', futura: 80, dias: 20, hab: 16, canc: 1, total: 8, min: 45, resp: 0.8, aut: true },
    { nome: 'Íris', esp: 'Oftalmologia', urg: 1, origem: 'fila', dias: 60, hab: 10, canc: 1, total: 3, min: 40, resp: 0.7, aut: true },
    { nome: 'João', esp: 'Oftalmologia', urg: 2, origem: 'agendado', futura: 45, dias: 50, hab: 14, canc: 0, total: 5, min: 25, resp: 0.85, aut: true },
    { nome: 'Lívia', esp: 'Oftalmologia', urg: 2, origem: 'fila', dias: 240, hab: 15, canc: 0, total: 2, min: 140, resp: 0.6, aut: false },
    { nome: 'Marcos', esp: 'Oftalmologia', urg: 3, origem: 'agendado', futura: 30, dias: 90, hab: 9, canc: 2, total: 4, min: 20, resp: 0.5, aut: true }
  ];
  var A_PADRAO = { b0: -1.5, hor: 1.2, canc: -2.5, dist: 1, antec: 0.8, ganho: 0.8, resp: 1 };
  function pesosAceite() {
    return {
      b0: num('a-b0', A_PADRAO.b0), hor: num('a-hor', A_PADRAO.hor), canc: num('a-canc', A_PADRAO.canc),
      dist: num('a-dist', A_PADRAO.dist), antec: num('a-antec', A_PADRAO.antec), ganho: num('a-ganho', A_PADRAO.ganho), resp: num('a-resp', A_PADRAO.resp)
    };
  }
  /* chance de aceitar a oferta; vaga: {hora, horas} */
  function aceite(c, vaga, w) {
    var dif = Math.abs(vaga.hora - c.hab), taxa = taxaSuavizada(c.canc, c.total);
    var ganhoDias = c.origem === 'agendado' ? c.futura : 90;
    var f = [
      { nome: 'Horário parecido com o habitual', valor: 'habitual ' + c.hab + 'h, vaga ' + vaga.hora + 'h', c: w.hor * (1 - Math.min(dif, 6) / 6) },
      { nome: 'Taxa de cancelamento', valor: c.canc + ' de ' + Math.max(c.total, c.canc) + ' (suavizada ' + fmtPct(taxa) + ')', c: w.canc * taxa },
      { nome: 'Proximidade', valor: c.min + ' min de deslocamento', c: w.dist * (1 - Math.min(c.min, 120) / 120) },
      { nome: 'Antecedência da oferta', valor: fmtNum(vaga.horas, 1) + ' h antes', c: w.antec * Math.min(vaga.horas, 24) / 24 },
      { nome: 'Tempo que o paciente ganha', valor: c.origem === 'agendado' ? 'antecipa ' + c.futura + ' dias' : 'na fila, sem data', c: w.ganho * Math.min(ganhoDias, 90) / 90 },
      { nome: 'Costuma responder mensagens', valor: fmtPct(c.resp), c: w.resp * (c.resp - 0.5) * 2 }
    ];
    var z = w.b0, i;
    for (i = 0; i < f.length; i++) { z += f[i].c; }
    return { p: sigmoid(z), z: z, fatores: f };
  }
  /* cfg: {modo, esp, hora, horas, resp, par, desempate} */
  function reofertar(cfg, w) {
    var disp = cfg.horas * 60, par = Math.max(1, Math.round(cfg.par)), cand = [], fora = [], i;
    for (i = 0; i < CANDIDATOS.length; i++) {
      var c = CANDIDATOS[i];
      if (c.esp !== cfg.esp) { continue; }
      var a = aceite(c, cfg, w);
      var item = { c: c, p: a.p, fatores: a.fatores, z: a.z };
      if (cfg.modo === 'privado' && !c.aut) { item.sit = 'Fora: sem autorização do convênio'; item.ok = false; fora.push(item); }
      else { cand.push(item); }
    }
    cand.sort(function (x, y) {
      if (x.c.urg !== y.c.urg) { return x.c.urg - y.c.urg; }
      if (cfg.desempate === 'espera') { return y.c.dias - x.c.dias; }
      if (y.p !== x.p) { return y.p - x.p; }
      return y.c.dias - x.c.dias;
    });
    var pos = 0, rodadas = [], linhas = [];
    for (i = 0; i < cand.length; i++) {
      var it = cand[i], rod = Math.floor(pos / par), fim = (rod + 1) * cfg.resp, chega = fim + it.c.min;
      if (chega <= disp) {
        it.ok = true; it.rodada = rod; it.fim = fim; pos++;
        if (!rodadas[rod]) { rodadas[rod] = []; }
        rodadas[rod].push(it);
        it.sit = 'Rodada ' + (rod + 1) + ': responde até ' + fim + ' min, chega em ' + chega + ' min';
      } else {
        it.ok = false; it.sit = 'Fora: não chegaria a tempo (' + chega + ' > ' + Math.round(disp) + ' min)';
      }
      linhas.push(it);
    }
    /* probabilidade de cada um ficar com a vaga: ninguém antes aceitou e ele aceita */
    var semAceite = 1, tempo = 0, cascata = 0, r, j;
    for (r = 0; r < rodadas.length; r++) {
      for (j = 0; j < rodadas[r].length; j++) {
        var x = rodadas[r][j];
        x.fica = semAceite * x.p;
        tempo += x.fica * rodadas[r][j].fim;
        if (x.c.origem === 'agendado') { cascata += x.fica; }
        semAceite *= (1 - x.p);
      }
    }
    for (i = 0; i < fora.length; i++) { fora[i].fica = 0; linhas.push(fora[i]); }
    for (i = 0; i < linhas.length; i++) { if (!linhas[i].ok) { linhas[i].fica = 0; } }
    var chance = 1 - semAceite, ofertados = pos;
    return {
      linhas: linhas, chance: ofertados ? chance : 0, ofertas: ofertados,
      tempo: chance > 0 ? tempo / chance : null, cascata: cascata,
      primeiro: rodadas[0] ? rodadas[0][0].c.nome : '-', rodadas: rodadas.length
    };
  }
  function lerVaga() {
    return {
      modo: $('v-modo') ? $('v-modo').value : 'publico',
      esp: $('v-esp') ? $('v-esp').value : 'Cardiologia',
      hora: clamp(Math.round(num('v-hora', 14)), 0, 23),
      horas: Math.max(0.5, num('v-horas', 6)),
      resp: Math.max(1, num('v-resp', 20)),
      par: clamp(num('v-par', 2), 1, 10),
      desempate: $('v-desempate') ? $('v-desempate').value : 'aceite'
    };
  }
  var selecionado = null;
  function mensagens(it, cfg) {
    var c = it.c, hh = (cfg.hora < 10 ? '0' : '') + cfg.hora + ':00';
    var quando = cfg.horas < 24 ? 'hoje' : 'amanhã';
    var situ = c.origem === 'agendado' ? 'antes da sua consulta marcada para daqui a ' + c.futura + ' dias' : 'e você está na lista de espera';
    var manter = c.origem === 'agendado' ? 'sua consulta atual continua igual' : 'sua posição na lista continua igual';
    return [
      ['Oferta (rodada ' + (it.rodada + 1) + ')', c.nome, 'Olá, ' + c.nome + '! Abriu um horário de ' + cfg.esp + ' ' + quando + ' às ' + hh + ' no Hospital Exemplo, ' + situ +
        '. Quer ficar com ele? Responda SIM em até ' + cfg.resp + ' minutos. Se não puder, tudo bem: ' + manter + '.'],
      ['Aceite confirmado', c.nome, 'Pronto, ' + c.nome + '! Sua consulta de ' + cfg.esp + ' ficou para ' + quando + ' às ' + hh + '. Leve documento e pedido médico.' +
        (c.origem === 'agendado' ? ' Sua consulta antiga foi liberada para outro paciente.' : '')],
      ['Vaga preenchida', 'Demais contatados', 'Obrigado pela resposta! Esse horário já foi preenchido. Nada mudou para você: ' + manter + '.'],
      ['Liberação da vaga (caso 1)', 'Quem cancelou', 'Recebemos seu aviso. Sua consulta foi cancelada sem nenhuma penalidade. Quer remarcar? Responda REMARCAR.']
    ];
  }
  function renderFila() {
    var cfg = lerVaga(), w = pesosAceite(), r = reofertar(cfg, w), i, html = '';
    setText('v-chance', fmtPct(r.chance));
    setText('v-tempo', r.tempo === null ? '-' : fmtInt(r.tempo) + ' min');
    setText('v-ofertas', String(r.ofertas));
    setText('v-primeiro', r.primeiro);
    setText('v-cascata', fmtPct(r.cascata));
    var idx = 0;
    for (i = 0; i < r.linhas.length; i++) {
      var l = r.linhas[i];
      html += '<tr data-nome="' + esc(l.c.nome) + '" tabindex="0" style="cursor:pointer"' + (selecionado === l.c.nome ? ' class="row-focus"' : '') + '><td>' + (l.ok ? ++idx : '-') + '</td><td>' + esc(l.c.nome) +
        '</td><td>' + URG_NOME[l.c.urg] + '</td><td>' + (l.c.origem === 'agendado' ? 'Antecipa (+' + l.c.futura + ' d)' : 'Fila (' + l.c.dias + ' d)') +
        '</td><td class="num">' + l.c.hab + 'h</td><td class="num">' + l.c.canc + '/' + Math.max(l.c.total, l.c.canc) +
        '</td><td class="num">' + l.c.min + '</td><td class="num">' + Math.round(l.p * 100) + '</td><td class="num">' + Math.round(l.fica * 100) +
        '</td><td class="small ' + (l.ok ? 'ok' : 'muted') + '">' + esc(l.sit) + '</td></tr>';
    }
    var body = $('v-body');
    if (body) { body.innerHTML = html; }
    var al = $('v-alerta');
    if (al) {
      if (r.ofertas === 0) {
        al.hidden = false;
        al.textContent = 'Ninguém consegue chegar a tempo: o horário provavelmente não será reocupado. O aviso do caso 1 precisa vir mais cedo, e é isso que a confirmação ativa busca.';
      } else { al.hidden = true; al.textContent = ''; }
    }
    /* detalhe do selecionado (padrão: primeiro ofertado) */
    var sel = null;
    for (i = 0; i < r.linhas.length; i++) { if (r.linhas[i].c.nome === selecionado) { sel = r.linhas[i]; } }
    if (!sel) { for (i = 0; i < r.linhas.length; i++) { if (r.linhas[i].ok) { sel = r.linhas[i]; break; } } }
    if (!sel && r.linhas.length) { sel = r.linhas[0]; }
    var det = '', msgs = '';
    if (sel) {
      setText('v-det-tit', 'Fatores do aceite: ' + sel.c.nome);
      det = '<tr><td>Constante</td><td class="small">-</td><td class="num">' + fmtSign(w.b0, 2) + '</td></tr>';
      for (i = 0; i < sel.fatores.length; i++) {
        det += '<tr><td>' + esc(sel.fatores[i].nome) + '</td><td class="small">' + esc(sel.fatores[i].valor) + '</td><td class="num">' + fmtSign(sel.fatores[i].c, 2) + '</td></tr>';
      }
      det += '<tr><td><strong>Chance de aceite</strong></td><td class="small">z = ' + fmtSign(sel.z, 2) + '</td><td class="num"><strong>' + fmtPct(sel.p) + '</strong></td></tr>';
      if (sel.ok) {
        var ms = mensagens(sel, cfg);
        for (i = 0; i < ms.length; i++) { msgs += '<tr><td>' + esc(ms[i][0]) + '</td><td>' + esc(ms[i][1]) + '</td><td class="small">' + esc(ms[i][2]) + '</td></tr>'; }
      } else {
        msgs = '<tr><td colspan="3" class="small">' + esc(sel.c.nome) + ' não recebe oferta: ' + esc(sel.sit.replace(/^Fora: /, '')) + '.</td></tr>';
      }
    }
    if ($('v-det')) { $('v-det').innerHTML = det; }
    if ($('v-msgs')) { $('v-msgs').innerHTML = msgs; }
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
    var aviso = s.faltas - s.evitadas, c1 = aviso * p.aviso, c4 = aviso - c1;
    var casos = [
      ['3 · Vai e confirma', p.agenda - s.faltas, 'Atendido como previsto.'],
      ['2 · Esqueceu, é lembrado e vai', s.evitadas, 'Falta evitada: atendimento recuperado.'],
      ['1 · Avisa que não vai', c1, 'Vaga liberada; ' + fmtInt(s.reoc) + ' reocupadas pelo motor (' + fmtPct(p.reoc) + ').'],
      ['4 · Não vai e não responde', c4, 'Horário perdido (política do hospital, D13).']
    ], ch = '', ci;
    for (ci = 0; ci < casos.length; ci++) {
      ch += '<tr><td>' + casos[ci][0] + '</td><td class="num">' + fmtInt(casos[ci][1]) + '</td><td class="small">' + esc(casos[ci][2]) + '</td></tr>';
    }
    if ($('s-casos')) { $('s-casos').innerHTML = ch; }
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
    { when: '07/11/2026 · 19:00', tag: 'Entrega', text: 'Documento reorganizado nas dez seções, com lab de risco, plano de confirmação, oferta à fila, retorno financeiro e teste de métricas.' },
    { when: '07/11/2026 · 19:49', tag: 'Decisão', text: 'O grupo avaliou um incentivo de comparecimento (desconto ou crédito) e decidiu tirá-lo do escopo. Fica arquivado como H6 e pode voltar após o piloto.' },
    { when: '07/11/2026 · 20:05', tag: 'Decisão', text: 'O produto passa a ser pensado pelos quatro casos de paciente. Foco no caso 1: motor de reoferta com urgência primeiro e, dentro dela, chance de aceite (horário parecido, sem histórico de cancelamento, proximidade); mensagens automáticas e cascata (D11 a D14).' }
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
    ligar(['v-modo', 'v-esp', 'v-hora', 'v-horas', 'v-resp', 'v-par', 'v-desempate', 'a-b0', 'a-hor', 'a-canc', 'a-dist', 'a-antec', 'a-ganho', 'a-resp'], renderFila);
    var vb = $('v-body');
    if (vb) {
      var escolher = function (ev) {
        var tr = ev.target;
        while (tr && tr.tagName !== 'TR') { tr = tr.parentNode; }
        if (!tr || !tr.getAttribute) { return; }
        if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') { return; }
        selecionado = tr.getAttribute('data-nome'); renderFila();
      };
      vb.addEventListener('click', escolher); vb.addEventListener('keydown', escolher);
    }
    var ve = $('v-esp');
    if (ve) { ve.addEventListener('change', function () { selecionado = null; renderFila(); }); }
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
  window.VagaViva = { risco: risco, faixa: faixa, reofertar: reofertar, aceite: aceite, candidatos: CANDIDATOS, simular: simular, avaliar: avaliar, gerar: gerar, pesos: W_PADRAO, taxaSuavizada: taxaSuavizada };
})();