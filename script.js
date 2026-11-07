/* Amparo · Lab de UI (vulnerabilidade financeira, direitos, documentos e painel da assistente social)
   e Diário de bordo.
   Todos os pacientes, valores e prazos do laboratório são fictícios e ilustrativos.
   As regras são simplificadas e servem para demonstrar o modelo. Não substituem a análise de uma
   assistente social ou de um advogado, e devem ser conferidas nas fontes listadas no documento. */
(function () {
  'use strict';

  /* ---------- utilitários ---------- */
  function $(id) { return document.getElementById(id); }
  function num(id, fallback) {
    var el = $(id);
    if (!el) return fallback;
    var v = parseFloat(String(el.value).replace(',', '.'));
    return isNaN(v) ? fallback : v;
  }
  function fmt(n, d) { return n.toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function brl(n) {
    return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function opt(value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- catálogos ---------- */
  var DX = [
    { id: 'cancer', nome: 'Câncer (neoplasia maligna)' },
    { id: 'hiv', nome: 'HIV' },
    { id: 'terminal', nome: 'Estágio terminal por doença grave' },
    { id: 'rara', nome: 'Doença rara (lista do Ministério da Saúde)' },
    { id: 'outra', nome: 'Outra doença grave (fora da lista da lei)' }
  ];
  var VINCULOS = [
    { id: 'clt', nome: 'CLT em atividade' },
    { id: 'desligado', nome: 'Desligado (já contribuiu)' },
    { id: 'contrib', nome: 'Autônomo ou MEI contribuinte' },
    { id: 'informal', nome: 'Informal, sem contribuição' }
  ];
  var DIREITOS = [
    { id: 'fgts', nome: 'Saque do FGTS por doença grave' },
    { id: 'inss', nome: 'Auxílio por incapacidade temporária (INSS)' },
    { id: 'bpc', nome: 'BPC (Benefício de Prestação Continuada)' },
    { id: 'ir', nome: 'Isenção de IR em aposentadoria por doença grave' }
  ];
  var ETAPAS = [
    ['nao_iniciado', 'Não iniciado'],
    ['docs', 'Reunindo documentos'],
    ['protocolado', 'Protocolado'],
    ['concluido', 'Concluído'],
    ['negado', 'Negado']
  ];
  var ESTADOS_DOC = [
    ['faltando', 'Faltando'],
    ['recebido', 'Recebido'],
    ['revisao', 'Em revisão'],
    ['pronto', 'Pronto'],
    ['vencido', 'Vencido']
  ];
  var NIVEIS = {
    enq: { rotulo: 'Enquadra', cls: 'pill-enq', ordem: 0 },
    ver: { rotulo: 'Verificar', cls: 'pill-ver', ordem: 1 },
    nao: { rotulo: 'Não enquadra', cls: 'pill-nao', ordem: 2 },
    na: { rotulo: 'Não se aplica agora', cls: 'pill-na', ordem: 3 }
  };

  function nomeDe(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i].nome;
    return id;
  }
  function direitoNome(id) { return nomeDe(DIREITOS, id); }

  /* ---------- pacientes fictícios ----------
     "titular" = quem tem a conta de FGTS e o vínculo; se o doente é dependente, vínculo, FGTS e
     contribuições são do titular. Valores em reais por mês, exceto saldo, reserva e prazos. */
  function base(id, nome, o) {
    var p = {
      id: id, nome: nome, dx: 'cancer', titular: true, vinculo: 'clt',
      contribMeses: 60, semContrib: 0, desemp: false, saldo: 0, incapaz: false, imped: false,
      aposent: false, rAntes: 3000, rAtual: 3000, morad: 3, desp: 2500, trat: 300, div: 200,
      reserva: 500, cuid: false, dias: 10, relMeses: 1,
      etapas: { fgts: 'nao_iniciado', inss: 'nao_iniciado', bpc: 'nao_iniciado', ir: 'nao_iniciado' },
      docs: {}
    };
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) p[k] = o[k];
    return p;
  }

  var PACIENTES_BASE = [
    base('A', 'Paciente A (câncer, CLT)', {
      dx: 'cancer', vinculo: 'clt', contribMeses: 96, saldo: 18000, incapaz: true,
      rAntes: 6500, rAtual: 3900, morad: 3, desp: 4200, trat: 700, div: 650, reserva: 6000, dias: 10,
      etapas: { fgts: 'docs', inss: 'nao_iniciado', bpc: 'nao_iniciado', ir: 'nao_iniciado' },
      docs: { 'fgts:relatorio': 'pronto', 'fgts:identidade': 'pronto', 'fgts:exame': 'recebido' }
    }),
    base('B', 'Paciente B (HIV, desligado)', {
      dx: 'hiv', vinculo: 'desligado', contribMeses: 30, semContrib: 8, desemp: true, saldo: 9500,
      incapaz: false, rAntes: 2600, rAtual: 1800, morad: 2, desp: 1900, trat: 150, div: 300,
      reserva: 1500, dias: 25
    }),
    base('C', 'Paciente C (criança com câncer, mãe titular)', {
      dx: 'cancer', titular: false, vinculo: 'clt', contribMeses: 60, saldo: 12000, cuid: true,
      rAntes: 5200, rAtual: 3100, morad: 3, desp: 4300, trat: 900, div: 800, reserva: 400,
      dias: 30, relMeses: 14,
      etapas: { fgts: 'docs', inss: 'nao_iniciado', bpc: 'nao_iniciado', ir: 'nao_iniciado' },
      docs: { 'fgts:relatorio': 'pronto', 'fgts:exame': 'pronto', 'fgts:identidade': 'pronto',
        'fgts:ctps': 'pronto', 'fgts:conta': 'recebido', 'fgts:dependencia': 'pronto' }
    }),
    base('D', 'Paciente D (estágio terminal, MEI)', {
      dx: 'terminal', vinculo: 'contrib', contribMeses: 40, saldo: 0, incapaz: true,
      rAntes: 2200, rAtual: 800, morad: 3, desp: 2000, trat: 450, div: 500, reserva: 100, dias: 18,
      etapas: { fgts: 'nao_iniciado', inss: 'protocolado', bpc: 'nao_iniciado', ir: 'nao_iniciado' }
    }),
    base('E', 'Paciente E (doença fora da lista, CLT)', {
      dx: 'outra', vinculo: 'clt', contribMeses: 14, saldo: 7200, incapaz: true,
      rAntes: 3400, rAtual: 1900, morad: 3, desp: 2800, trat: 520, div: 400, reserva: 900, dias: 45,
      etapas: { fgts: 'negado', inss: 'docs', bpc: 'nao_iniciado', ir: 'nao_iniciado' }
    }),
    base('F', 'Paciente F (câncer, informal)', {
      dx: 'cancer', vinculo: 'informal', contribMeses: 0, saldo: 0, incapaz: true, imped: true,
      rAntes: 1500, rAtual: 0, morad: 3, desp: 1400, trat: 250, div: 100, reserva: 0, dias: 12
    }),
    base('G', 'Paciente G (câncer, aposentado)', {
      dx: 'cancer', vinculo: 'contrib', contribMeses: 300, aposent: true, saldo: 5000,
      rAntes: 3000, rAtual: 3000, morad: 2, desp: 2400, trat: 600, div: 0, reserva: 8000, dias: 60,
      etapas: { fgts: 'concluido', inss: 'nao_iniciado', bpc: 'nao_iniciado', ir: 'nao_iniciado' }
    }),
    base('H', 'Paciente H (doença rara, CLT)', {
      dx: 'rara', vinculo: 'clt', contribMeses: 12, saldo: 22000, incapaz: true,
      rAntes: 7500, rAtual: 5200, morad: 4, desp: 4800, trat: 1100, div: 900, reserva: 6000, dias: 8
    }),
    base('I', 'Paciente I (câncer, desligado há 20 meses)', {
      dx: 'cancer', vinculo: 'desligado', contribMeses: 150, semContrib: 20, saldo: 6800,
      incapaz: true, rAntes: 3500, rAtual: 1800, morad: 2, desp: 2400, trat: 380, div: 350,
      reserva: 5000, dias: 22
    }),
    base('J', 'Paciente J (câncer, desligado há 30 meses)', {
      dx: 'cancer', vinculo: 'desligado', contribMeses: 40, semContrib: 30, saldo: 4000,
      incapaz: true, imped: false, rAntes: 2100, rAtual: 600, morad: 3, desp: 1900, trat: 300,
      div: 250, reserva: 0, dias: 35
    }),
    base('K', 'Paciente K (HIV, renda estável)', {
      dx: 'hiv', vinculo: 'clt', contribMeses: 84, saldo: 15000, incapaz: false,
      rAntes: 9000, rAtual: 9000, morad: 2, desp: 5200, trat: 200, div: 400, reserva: 20000,
      dias: 5
    })
  ];

  var pacientes = clone(PACIENTES_BASE);
  var atual = pacientes[0];

  /* ---------- premissas ---------- */
  var PESOS_IDS = [
    ['renda', 'in-w-renda'], ['perda', 'in-w-perda'], ['desp', 'in-w-desp'],
    ['div', 'in-w-div'], ['folego', 'in-w-folego'], ['cuid', 'in-w-cuid']
  ];

  function premissas() {
    var pesos = {};
    var soma = 0;
    PESOS_IDS.forEach(function (x) {
      var v = Math.max(0, num(x[1], 0));
      pesos[x[0]] = v;
      soma += v;
    });
    PESOS_IDS.forEach(function (x) {
      pesos[x[0]] = soma > 0 ? pesos[x[0]] / soma : 1 / PESOS_IDS.length;
    });
    return {
      sm: Math.max(1, num('in-sm', 1621)),
      pesos: pesos,
      alto: num('in-alto', 60),
      medio: num('in-medio', 35),
      refMeses: Math.max(1, num('in-ref', 6)),
      validade: Math.max(0, num('in-validade', 12)),
      minSem: Math.max(0, num('in-min-sem', 90)),
      minCom: Math.max(0, num('in-min-com', 30))
    };
  }

  /* ---------- 7.2 identificador de direitos ---------- */
  function regraFgts(p) {
    var base = 'Lei 8.036/1990, art. 20 (incisos XI, XIII, XIV e XXII); página da Caixa sobre saque por doença grave.';
    var r = { id: 'fgts', base: base, nivel: 'nao', motivo: '', passos: [] };
    if (p.saldo <= 0) {
      r.motivo = 'Sem saldo de FGTS na conta (vínculo informal, MEI ou saldo já retirado).';
      r.passos = ['Conferir no app FGTS se existe saldo em contas de vínculos anteriores.'];
      return r;
    }
    if (p.dx === 'cancer') {
      r.nivel = 'enq';
      r.motivo = 'Neoplasia maligna do titular ou de dependente é hipótese própria da lei e não exige estágio terminal.';
    } else if (p.dx === 'hiv') {
      r.nivel = 'enq';
      r.motivo = 'HIV do titular ou de dependente é hipótese própria da lei e não exige estágio terminal.';
    } else if (p.dx === 'terminal') {
      r.nivel = 'enq';
      r.motivo = 'Exige atestado que diga expressamente que a pessoa está em estágio terminal, com CID.';
    } else if (p.dx === 'rara') {
      r.nivel = 'ver';
      r.motivo = 'A lei prevê doença rara reconhecida pelo Ministério da Saúde. Conferir se o diagnóstico consta e qual o regulamento.';
    } else {
      r.nivel = 'ver';
      r.motivo = 'Fora da lista da lei. A Caixa tende a negar. Há decisões judiciais favoráveis (o STJ trata a lista como exemplificativa), e o juiz pode exigir prova da necessidade do saldo. Via judicial.';
    }
    r.passos = r.nivel === 'ver' && p.dx === 'outra'
      ? ['Reunir laudo detalhado e prova da necessidade do saldo.', 'Encaminhar à Defensoria ou a assistência jurídica gratuita se a Caixa negar.']
      : ['Obter o relatório médico no formulário da Caixa e o exame comprobatório.', 'Pedir o saque pelo app FGTS (Saques, Solicitar saque, Doença grave).'];
    return r;
  }

  function regraInss(p) {
    var base = 'Lei 8.213/1991 (arts. 15, 25 e 59); orientações do INSS. Regra simplificada.';
    var r = { id: 'inss', base: base, nivel: 'nao', motivo: '', passos: [] };
    if (p.aposent) {
      r.nivel = 'na';
      r.motivo = 'Já recebe aposentadoria. Conferir no INSS se há acúmulo possível.';
      return r;
    }
    if (!p.titular) {
      r.nivel = 'na';
      r.motivo = 'O auxílio é do segurado incapacitado. Aqui o doente é dependente.';
      return r;
    }
    if (p.vinculo === 'informal') {
      r.motivo = 'Sem contribuição não há qualidade de segurado. Avaliar o BPC.';
      return r;
    }
    var ativo = p.vinculo === 'clt' || p.vinculo === 'contrib';
    var graca = 12 + (p.contribMeses >= 120 ? 12 : 0) + (p.desemp ? 12 : 0);
    var qualidade = ativo || p.semContrib <= graca;
    var semCarencia = p.dx === 'cancer' || p.dx === 'hiv';
    if (!qualidade) {
      r.motivo = 'Último recolhimento há ' + p.semContrib + ' meses, acima do período de graça simplificado de ' + graca + ' meses. Conferir o CNIS e o art. 15.';
      r.passos = ['Conferir o CNIS e a data do último recolhimento.'];
      return r;
    }
    if (p.contribMeses < 12 && !semCarencia) {
      r.nivel = 'ver';
      r.motivo = 'Menos de 12 contribuições. Depende de a doença constar na lista que dispensa a carência (conferir a lista atual).';
      r.passos = ['Conferir a lista de doenças que dispensam carência.'];
      return r;
    }
    if (!p.incapaz) {
      r.nivel = 'nao';
      r.motivo = 'O benefício depende de incapacidade para o trabalho, não só do diagnóstico. Reavaliar se o afastamento for necessário.';
      r.passos = ['Pedir ao médico assistente que registre a avaliação da capacidade de trabalho.'];
      return r;
    }
    r.nivel = 'enq';
    r.motivo = 'Qualidade de segurado' + (ativo ? '' : ' (dentro do período de graça)') + ' e carência atendidas pelos dados informados. Falta provar a incapacidade com laudo atualizado. A perícia decide.';
    r.passos = ['Montar o laudo atualizado com CID e descrição da incapacidade.', 'Conferir o CNIS antes de pedir pelo Meu INSS.'];
    return r;
  }

  function regraBpc(p, prem) {
    var r = {
      id: 'bpc', nivel: 'nao', motivo: '', passos: [],
      base: 'Lei 8.742/1993 (LOAS), art. 20; cartilha do BPC (INSS). O cálculo do INSS desconsidera alguns benefícios de até 1 salário mínimo, o que o lab não implementa.'
    };
    var rpc = p.rAtual / Math.max(1, p.morad);
    var lim = prem.sm / 4;
    if (rpc <= lim) {
      if (p.imped) {
        r.nivel = 'enq';
        r.motivo = 'Renda por pessoa de ' + brl(rpc) + ', até 1/4 do salário mínimo (' + brl(lim) + '), e impedimento de longo prazo a ser avaliado pelo INSS (avaliação médica e social).';
        r.passos = ['Atualizar o CadÚnico (a conferir).', 'Reunir laudo sobre o impedimento de longo prazo.'];
      } else {
        r.nivel = 'ver';
        r.motivo = 'Renda por pessoa dentro do limite de 1/4 do salário mínimo. Falta caracterizar o impedimento de longo prazo.';
        r.passos = ['Pedir ao médico a descrição do impedimento de longo prazo.'];
      }
    } else if (rpc <= prem.sm / 2) {
      r.nivel = 'ver';
      r.motivo = 'Renda por pessoa entre 1/4 e 1/2 salário mínimo. A lei prevê flexibilização até 1/2 conforme critérios, que dependem de regulamentação. Conferir.';
      r.passos = ['Conferir os critérios atuais de flexibilização do limite de renda.'];
    } else {
      r.motivo = 'Renda por pessoa de ' + brl(rpc) + ', acima de 1/2 salário mínimo.';
    }
    return r;
  }

  function regraIr(p) {
    var r = {
      id: 'ir', nivel: 'na', passos: [],
      base: 'Lei 7.713/1988 (lista de doenças graves para isenção); exigências de laudo a conferir.'
    };
    if (!p.aposent) {
      r.motivo = 'A isenção vale para aposentadoria, pensão ou reforma. Reavaliar se a pessoa se aposentar por incapacidade.';
      return r;
    }
    r.nivel = 'ver';
    r.motivo = (p.dx === 'cancer' || p.dx === 'hiv')
      ? 'Neoplasia maligna e AIDS constam da lista de doenças graves para isenção. Exige laudo de serviço médico oficial (conferir exigências atuais).'
      : 'Conferir se a doença consta da lista de doenças graves para isenção.';
    r.passos = ['Obter o laudo de serviço médico oficial (a conferir).', 'Apresentar à fonte pagadora do benefício.'];
    return r;
  }

  function direitos(p, prem) {
    return [regraFgts(p), regraInss(p), regraBpc(p, prem), regraIr(p)];
  }

  /* ---------- 7.3 organizador documental ---------- */
  function itensDoc(p, d) {
    var it = [];
    if (d === 'fgts') {
      it.push({ k: 'relatorio', nome: 'Relatório Médico de Doenças Graves (formulário da Caixa)', nota: 'Assinatura sobre carimbo ou certificado digital, com CRM do médico assistente. Tem prazo de validade.' });
      var exame = {
        cancer: 'Exame anatomopatológico ou histopatológico',
        hiv: 'Exame de carga viral ou sorologia',
        terminal: 'Atestado com a expressão "estágio terminal" e o CID',
        rara: 'Documentação do diagnóstico da doença rara',
        outra: 'Laudo detalhado e prova da necessidade do saldo (para a ação judicial)'
      };
      it.push({ k: 'exame', nome: exame[p.dx], nota: 'Anexar ao pedido.' });
      it.push({ k: 'identidade', nome: 'Documento de identidade com foto e CPF', nota: '' });
      it.push({ k: 'ctps', nome: 'Carteira de trabalho ou número do PIS/Pasep', nota: '' });
      it.push({ k: 'conta', nome: 'Dados da conta bancária do solicitante', nota: '' });
      if (!p.titular) it.push({ k: 'dependencia', nome: 'Comprovante de dependência (certidão de casamento, nascimento ou guarda)', nota: '' });
    } else if (d === 'inss') {
      it.push({ k: 'laudo', nome: 'Laudo ou atestado atualizado com CID e descrição da incapacidade para o trabalho', nota: 'Documento antigo que não prova a incapacidade atual é motivo comum de negativa.' });
      it.push({ k: 'exames', nome: 'Exames e relatórios que sustentem o laudo', nota: '' });
      it.push({ k: 'cnis', nome: 'CNIS conferido: vínculos e contribuições sem divergência', nota: 'Divergências no CNIS causam negativas indevidas.' });
      it.push({ k: 'gov', nome: 'Conta gov.br e acesso ao Meu INSS', nota: '' });
      if (p.vinculo === 'desligado') it.push({ k: 'deslig', nome: 'Comprovante de desligamento e do último recolhimento', nota: '' });
    } else if (d === 'bpc') {
      it.push({ k: 'cad', nome: 'CadÚnico atualizado', nota: 'A conferir.' });
      it.push({ k: 'renda', nome: 'Comprovação de renda e da composição da família', nota: '' });
      it.push({ k: 'imped', nome: 'Laudo sobre o impedimento de longo prazo', nota: '' });
    } else if (d === 'ir') {
      it.push({ k: 'laudoOficial', nome: 'Laudo de serviço médico oficial', nota: 'A conferir.' });
      it.push({ k: 'comprov', nome: 'Comprovante de rendimentos da aposentadoria ou pensão', nota: '' });
    }
    return it;
  }

  function estadoDoc(p, d, item, prem) {
    var est = p.docs[d + ':' + item.k] || 'faltando';
    if (d === 'fgts' && item.k === 'relatorio' && est === 'pronto' && p.relMeses > prem.validade) {
      return 'vencido';
    }
    return est;
  }

  function prontidao(p, d, prem) {
    var itens = itensDoc(p, d);
    if (!itens.length) return { pct: 0, prontos: 0, total: 0, pend: [], vencidos: 0 };
    var prontos = 0;
    var pend = [];
    var venc = 0;
    itens.forEach(function (it) {
      var e = estadoDoc(p, d, it, prem);
      if (e === 'pronto') prontos++;
      else pend.push(it.nome);
      if (e === 'vencido') venc++;
    });
    return { pct: Math.round(100 * prontos / itens.length), prontos: prontos, total: itens.length, pend: pend, vencidos: venc };
  }

  /* ---------- 7.1 calculadora de vulnerabilidade financeira ---------- */
  function indice(p, prem, dirs) {
    var rpc = p.rAtual / Math.max(1, p.morad);
    var c1 = clamp((2 * prem.sm - rpc) / (1.75 * prem.sm), 0, 1);
    var perda = p.rAntes > 0 ? clamp((p.rAntes - p.rAtual) / p.rAntes, 0, 1) : 0;
    var c2 = clamp(perda / 0.5, 0, 1);
    var rTrat = p.rAtual > 0 ? p.trat / p.rAtual : (p.trat > 0 ? 1 : 0);
    var c3 = clamp(rTrat / 0.3, 0, 1);
    var rDiv = p.rAtual > 0 ? p.div / p.rAtual : (p.div > 0 ? 1 : 0);
    var c4 = clamp(rDiv / 0.3, 0, 1);
    var deficit = Math.max(0, p.desp + p.trat - p.rAtual);
    var meses = deficit > 0 ? p.reserva / deficit : Infinity;
    var fgts = 0;
    dirs.forEach(function (r) { if (r.id === 'fgts' && r.nivel === 'enq') fgts = p.saldo; });
    var mesesFgts = deficit > 0 ? (p.reserva + fgts) / deficit : Infinity;
    var c5 = deficit === 0 ? 0 : 1 - clamp(meses / prem.refMeses, 0, 1);
    var c6 = p.cuid ? 1 : 0;

    var comps = [
      { id: 'renda', nome: 'Renda por pessoa', dado: brl(rpc) + ' por pessoa (' + pct(rpc / prem.sm) + ' do salário mínimo)', v: c1 },
      { id: 'perda', nome: 'Queda de renda da família', dado: 'queda de ' + pct(perda), v: c2 },
      { id: 'desp', nome: 'Peso do tratamento na renda', dado: 'gasto com tratamento = ' + pct(clamp(rTrat, 0, 9.99)) + ' da renda', v: c3 },
      { id: 'div', nome: 'Peso das dívidas na renda', dado: 'parcelas = ' + pct(clamp(rDiv, 0, 9.99)) + ' da renda', v: c4 },
      { id: 'folego', nome: 'Fôlego da reserva', dado: deficit === 0 ? 'sem déficit mensal' : 'reserva cobre ' + fmt(meses, 1) + ' meses do déficit de ' + brl(deficit), v: c5 },
      { id: 'cuid', nome: 'Cuidador parou de trabalhar', dado: p.cuid ? 'sim' : 'não', v: c6 }
    ];
    var total = 0;
    comps.forEach(function (c) {
      c.peso = prem.pesos[c.id];
      c.pontos = 100 * c.peso * c.v;
      total += c.pontos;
    });
    var banda = total >= prem.alto ? 'Alta' : (total >= prem.medio ? 'Média' : 'Baixa');
    return { total: total, banda: banda, comps: comps, rpc: rpc, deficit: deficit, meses: meses, mesesFgts: mesesFgts, fgts: fgts };
  }

  /* ---------- análise completa de um paciente ---------- */
  function analisa(p, prem) {
    var dirs = direitos(p, prem);
    var ind = indice(p, prem, dirs);
    var aplic = dirs.filter(function (r) { return r.nivel === 'enq' || r.nivel === 'ver'; });
    var pront = {};
    var venc = 0;
    var pendTotal = 0;
    dirs.forEach(function (r) {
      if (r.nivel === 'enq' || r.nivel === 'ver') {
        pront[r.id] = prontidao(p, r.id, prem);
        venc += pront[r.id].vencidos;
        pendTotal += pront[r.id].pend.length;
      }
    });
    var enq = dirs.filter(function (r) { return r.nivel === 'enq'; });
    var semPedido = enq.length > 0 && p.dias > 14 && enq.every(function (r) { return p.etapas[r.id] === 'nao_iniciado'; });
    var negado = dirs.filter(function (r) { return p.etapas[r.id] === 'negado'; });
    var prioridade = ind.total + (venc > 0 ? 15 : 0) + (semPedido ? 10 : 0) + (negado.length ? 10 : 0);
    var proxima = proximaAcao(p, dirs, pront);
    return { p: p, dirs: dirs, ind: ind, aplic: aplic, enq: enq, pront: pront, venc: venc, pendTotal: pendTotal,
      semPedido: semPedido, negado: negado, prioridade: prioridade, proxima: proxima };
  }

  function proximaAcao(p, dirs, pront) {
    var i;
    for (i = 0; i < dirs.length; i++) {
      if (p.etapas[dirs[i].id] === 'negado') {
        return 'Avaliar recurso ou Defensoria: ' + direitoNome(dirs[i].id);
      }
    }
    var cand = dirs.filter(function (r) { return r.nivel === 'enq' || r.nivel === 'ver'; });
    if (!cand.length) return 'Sem direito identificado: revisar os dados ou encaminhar ao serviço social.';
    /* Primeiro o que ainda não foi protocolado (direitos que enquadram antes dos a verificar),
       depois o acompanhamento do que já está protocolado. */
    var abertos = cand.filter(function (r) {
      var et = p.etapas[r.id];
      return et !== 'protocolado' && et !== 'concluido';
    });
    abertos.sort(function (a, b) { return NIVEIS[a.nivel].ordem - NIVEIS[b.nivel].ordem; });
    if (abertos.length) {
      var r = abertos[0];
      var pr = pront[r.id];
      if (pr && pr.pct < 100) return 'Completar documentos (' + pr.pend.length + ' pendentes): ' + direitoNome(r.id);
      return 'Protocolar: ' + direitoNome(r.id);
    }
    for (i = 0; i < cand.length; i++) {
      if (p.etapas[cand[i].id] === 'protocolado') return 'Acompanhar: ' + direitoNome(cand[i].id);
    }
    return 'Encerrar o acompanhamento.';
  }

  /* ---------- formulário do paciente em foco ---------- */
  var CAMPOS = [
    { id: 'f-dx', key: 'dx', t: 's' }, { id: 'f-titular', key: 'titular', t: 'tit' },
    { id: 'f-vinculo', key: 'vinculo', t: 's' }, { id: 'f-contrib', key: 'contribMeses', t: 'n' },
    { id: 'f-semcontrib', key: 'semContrib', t: 'n' }, { id: 'f-desemp', key: 'desemp', t: 'c' },
    { id: 'f-saldo', key: 'saldo', t: 'n' }, { id: 'f-incapaz', key: 'incapaz', t: 'c' },
    { id: 'f-imped', key: 'imped', t: 'c' }, { id: 'f-aposent', key: 'aposent', t: 'c' },
    { id: 'f-rantes', key: 'rAntes', t: 'n' }, { id: 'f-ratual', key: 'rAtual', t: 'n' },
    { id: 'f-morad', key: 'morad', t: 'n' }, { id: 'f-desp', key: 'desp', t: 'n' },
    { id: 'f-trat', key: 'trat', t: 'n' }, { id: 'f-div', key: 'div', t: 'n' },
    { id: 'f-reserva', key: 'reserva', t: 'n' }, { id: 'f-cuid', key: 'cuid', t: 'c' },
    { id: 'f-dias', key: 'dias', t: 'n' }, { id: 'f-relmeses', key: 'relMeses', t: 'n' }
  ];

  function carregaCampos() {
    CAMPOS.forEach(function (c) {
      var e = $(c.id);
      if (!e) return;
      var v = atual[c.key];
      if (c.t === 'c') e.checked = !!v;
      else if (c.t === 'tit') e.value = v ? 'titular' : 'dependente';
      else e.value = v;
    });
  }

  function leCampo(c) {
    var e = $(c.id);
    if (!e) return;
    if (c.t === 'c') atual[c.key] = e.checked;
    else if (c.t === 'tit') atual[c.key] = e.value === 'titular';
    else if (c.t === 'n') {
      var v = parseFloat(String(e.value).replace(',', '.'));
      atual[c.key] = isNaN(v) ? 0 : Math.max(0, v);
    } else atual[c.key] = e.value;
  }

  /* ---------- renderização ---------- */
  function pill(nivel) {
    var n = NIVEIS[nivel];
    return el('span', 'pill ' + n.cls, n.rotulo);
  }

  function bandaCls(b) { return b === 'Alta' ? 'band-alta' : (b === 'Média' ? 'band-media' : 'band-baixa'); }

  function renderIndice(a, prem) {
    var ind = a.ind;
    $('res-indice').textContent = Math.round(ind.total);
    var rb = $('res-banda');
    rb.textContent = ind.banda;
    rb.className = 'result-num ' + bandaCls(ind.banda);
    $('res-folego').textContent = ind.meses === Infinity ? 'sem déficit' : fmt(ind.meses, 1);
    $('res-folego-fgts').textContent = ind.mesesFgts === Infinity ? 'sem déficit' : fmt(ind.mesesFgts, 1);
    $('res-rpc').textContent = brl(ind.rpc);
    var body = $('comp-body');
    body.innerHTML = '';
    ind.comps.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', '', c.nome));
      tr.appendChild(el('td', '', c.dado));
      var tdm = el('td', '');
      var m = el('span', 'meter');
      var f = el('span', 'meter-fill');
      f.style.width = Math.round(c.v * 100) + '%';
      m.appendChild(f);
      tdm.appendChild(m);
      tdm.appendChild(el('span', 'small', ' ' + pct(c.v)));
      tr.appendChild(tdm);
      tr.appendChild(el('td', 'num', pct(c.peso)));
      tr.appendChild(el('td', 'num', fmt(c.pontos, 1)));
      body.appendChild(tr);
    });
  }

  function renderDireitos(a, prem) {
    var p = a.p;
    var body = $('rights-body');
    body.innerHTML = '';
    a.dirs.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', '', direitoNome(r.id)));
      var tdn = el('td', '');
      tdn.appendChild(pill(r.nivel));
      tr.appendChild(tdn);
      var tdm = el('td', '', r.motivo);
      if (r.passos && r.passos.length && (r.nivel === 'enq' || r.nivel === 'ver')) {
        var ul = el('ul', 'steps-mini');
        r.passos.forEach(function (s) { ul.appendChild(el('li', '', s)); });
        tdm.appendChild(ul);
      }
      tr.appendChild(tdm);
      tr.appendChild(el('td', 'small', r.base));
      var tde = el('td', '');
      if (r.nivel === 'enq' || r.nivel === 'ver') {
        var sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Etapa: ' + direitoNome(r.id));
        ETAPAS.forEach(function (x) { sel.appendChild(opt(x[0], x[1])); });
        sel.value = p.etapas[r.id];
        sel.addEventListener('change', function () { p.etapas[r.id] = sel.value; render(); });
        tde.appendChild(sel);
      } else tde.appendChild(el('span', 'muted', '—'));
      tr.appendChild(tde);
      var tdp = el('td', 'num');
      if (a.pront[r.id]) tdp.textContent = a.pront[r.id].pct + '%';
      else tdp.textContent = '—';
      tr.appendChild(tdp);
      body.appendChild(tr);
    });
    var al = $('rights-alert');
    var msgs = [];
    if (a.venc > 0) msgs.push('Há documento vencido: o relatório médico tem ' + p.relMeses + ' meses e a validade configurada é de ' + prem.validade + '.');
    if (a.negado.length) msgs.push('Há pedido negado: avaliar recurso ou Defensoria antes de desistir.');
    al.textContent = msgs.join(' ');
    al.hidden = msgs.length === 0;
  }

  function renderDocs(a, prem) {
    var p = a.p;
    var body = $('docs-body');
    body.innerHTML = '';
    var tem = false;
    a.dirs.forEach(function (r) {
      if (r.nivel !== 'enq' && r.nivel !== 'ver') return;
      itensDoc(p, r.id).forEach(function (it) {
        tem = true;
        var tr = document.createElement('tr');
        tr.appendChild(el('td', '', direitoNome(r.id)));
        tr.appendChild(el('td', '', it.nome));
        tr.appendChild(el('td', 'small', it.nota));
        var td = el('td', '');
        var sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Situação: ' + it.nome);
        ESTADOS_DOC.forEach(function (x) { sel.appendChild(opt(x[0], x[1])); });
        var efetivo = estadoDoc(p, r.id, it, prem);
        sel.value = efetivo;
        sel.addEventListener('change', function () { p.docs[r.id + ':' + it.k] = sel.value; render(); });
        td.appendChild(sel);
        if (efetivo === 'vencido' && (p.docs[r.id + ':' + it.k] || '') === 'pronto') {
          td.appendChild(el('span', 'warn small', ' vencido pela validade'));
        } else if (efetivo === 'pronto') td.appendChild(el('span', 'ok small', ' ✓'));
        tr.appendChild(td);
        body.appendChild(tr);
      });
    });
    if (!tem) {
      var tr0 = document.createElement('tr');
      var td0 = el('td', 'muted', 'Nenhum direito com enquadramento ou a verificar para este paciente.');
      td0.colSpan = 4;
      tr0.appendChild(td0);
      body.appendChild(tr0);
    }
  }

  var filtroBanda = 'todas';

  function renderPainel(prem) {
    var analises = pacientes.map(function (p) { return analisa(p, prem); });
    analises.sort(function (x, y) {
      return y.prioridade - x.prioridade || (x.p.nome < y.p.nome ? -1 : 1);
    });
    var body = $('panel-body');
    body.innerHTML = '';
    var lista = analises.filter(function (a) { return filtroBanda === 'todas' || a.ind.banda === filtroBanda; });
    lista.forEach(function (a) {
      var tr = document.createElement('tr');
      if (a.p === atual) tr.className = 'row-focus';
      tr.appendChild(el('td', '', a.p.nome));
      var tdi = el('td', 'num');
      tdi.appendChild(el('span', bandaCls(a.ind.banda), Math.round(a.ind.total) + ' · ' + a.ind.banda));
      tr.appendChild(tdi);
      var tdd = el('td', '');
      if (a.enq.length) tdd.textContent = a.enq.map(function (r) { return direitoNome(r.id).split(' (')[0]; }).join('; ');
      else tdd.appendChild(el('span', 'muted', 'nenhum enquadra'));
      tr.appendChild(tdd);
      var foco = a.enq.length ? a.enq : a.aplic;
      var prs = foco.map(function (r) { return a.pront[r.id].pct; });
      var media = prs.length ? Math.round(prs.reduce(function (s, x) { return s + x; }, 0) / prs.length) : null;
      tr.appendChild(el('td', 'num', media === null ? '—' : media + '%'));
      var tda = el('td', '');
      var alertas = [];
      if (a.venc > 0) alertas.push('documento vencido');
      if (a.semPedido) alertas.push('sem pedido há ' + a.p.dias + ' dias');
      if (a.negado.length) alertas.push('pedido negado');
      if (alertas.length) tda.appendChild(el('span', 'warn', alertas.join('; ')));
      else tda.appendChild(el('span', 'muted', '—'));
      tr.appendChild(tda);
      tr.appendChild(el('td', '', a.proxima));
      var tdb = el('td', '');
      var btn = el('button', 'btn', 'Abrir');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Abrir ' + a.p.nome);
      btn.addEventListener('click', function () {
        atual = a.p;
        $('sel-paciente').value = a.p.id;
        carregaCampos();
        render();
        var alvo = $('lab-foco');
        if (alvo && alvo.scrollIntoView) alvo.scrollIntoView();
      });
      tdb.appendChild(btn);
      tr.appendChild(tdb);
      body.appendChild(tr);
    });

    var alta = analises.filter(function (a) { return a.ind.banda === 'Alta'; }).length;
    var enqTotal = analises.reduce(function (s, a) { return s + a.enq.length; }, 0);
    var fgtsTotal = analises.reduce(function (s, a) {
      return s + (a.dirs.some(function (r) { return r.id === 'fgts' && r.nivel === 'enq'; }) ? a.p.saldo : 0);
    }, 0);
    var vencTotal = analises.filter(function (a) { return a.venc > 0; }).length;
    var dossies = analises.reduce(function (s, a) { return s + a.aplic.length; }, 0);
    var horas = dossies * Math.max(0, prem.minSem - prem.minCom) / 60;
    $('kpi-n').textContent = analises.length;
    $('kpi-alta').textContent = alta;
    $('kpi-enq').textContent = enqTotal;
    $('kpi-fgts').textContent = brl(fgtsTotal);
    $('kpi-venc').textContent = vencTotal;
    $('kpi-horas').textContent = fmt(horas, 1);
  }

  function resumoMarkdown() {
    var prem = premissas();
    var a = analisa(atual, prem);
    var ind = a.ind;
    var l = [];
    l.push('# Resumo do caso · ' + atual.nome + ' (dados fictícios)');
    l.push('');
    l.push('- Diagnóstico: ' + nomeDe(DX, atual.dx) + (atual.titular ? ' (titular)' : ' (dependente)'));
    l.push('- Índice de vulnerabilidade: ' + Math.round(ind.total) + ' (' + ind.banda + '). É um índice de priorização de fila, não de elegibilidade.');
    l.push('- Fôlego da reserva: ' + (ind.meses === Infinity ? 'sem déficit mensal' : fmt(ind.meses, 1) + ' meses') +
      (ind.fgts > 0 ? '; com o saque do FGTS: ' + fmt(ind.mesesFgts, 1) + ' meses' : ''));
    l.push('');
    l.push('## Direitos');
    a.dirs.forEach(function (r) {
      l.push('- **' + direitoNome(r.id) + ':** ' + NIVEIS[r.nivel].rotulo + '. ' + r.motivo);
    });
    l.push('');
    l.push('## Pendências de documentos');
    var algum = false;
    a.aplic.forEach(function (r) {
      var pr = a.pront[r.id];
      if (pr.pend.length) {
        algum = true;
        l.push('- ' + direitoNome(r.id) + ' (' + pr.pct + '% pronto): ' + pr.pend.join('; '));
      }
    });
    if (!algum) l.push('- Nenhuma pendência registrada.');
    l.push('');
    l.push('## Próxima ação');
    l.push('- ' + a.proxima);
    l.push('');
    l.push('_Regras simplificadas. Conferir nas fontes e com a assistente social ou um advogado antes de orientar o paciente._');
    return l.join('\n') + '\n';
  }

  function render() {
    var prem = premissas();
    var a = analisa(atual, prem);
    renderIndice(a, prem);
    renderDireitos(a, prem);
    renderDocs(a, prem);
    renderPainel(prem);
    if (resumoOn) renderResumo();
  }

  var resumoOn = false;
  function renderResumo() {
    var pre = $('resumo-out');
    pre.textContent = resumoMarkdown();
    pre.hidden = false;
    $('resumo-copy').hidden = false;
  }

  function initLab() {
    if (!$('sel-paciente')) return;
    var sel = $('sel-paciente');
    pacientes.forEach(function (p) { sel.appendChild(opt(p.id, p.nome)); });
    sel.value = atual.id;
    DX.forEach(function (x) { $('f-dx').appendChild(opt(x.id, x.nome)); });
    VINCULOS.forEach(function (x) { $('f-vinculo').appendChild(opt(x.id, x.nome)); });
    $('f-titular').appendChild(opt('titular', 'Titular da conta'));
    $('f-titular').appendChild(opt('dependente', 'Dependente do titular'));
    carregaCampos();

    sel.addEventListener('change', function () {
      for (var i = 0; i < pacientes.length; i++) if (pacientes[i].id === sel.value) atual = pacientes[i];
      carregaCampos();
      render();
    });
    CAMPOS.forEach(function (c) {
      var e = $(c.id);
      var h = function () { leCampo(c); render(); };
      e.addEventListener('input', h);
      e.addEventListener('change', h);
    });
    ['in-sm', 'in-alto', 'in-medio', 'in-ref', 'in-validade', 'in-min-sem', 'in-min-com']
      .concat(PESOS_IDS.map(function (x) { return x[1]; }))
      .forEach(function (id) {
        $(id).addEventListener('input', render);
        $(id).addEventListener('change', render);
      });
    $('filtro-banda').addEventListener('change', function () { filtroBanda = $('filtro-banda').value; render(); });
    $('btn-restaurar').addEventListener('click', function () {
      var id = atual.id;
      pacientes = clone(PACIENTES_BASE);
      atual = pacientes[0];
      for (var i = 0; i < pacientes.length; i++) if (pacientes[i].id === id) atual = pacientes[i];
      carregaCampos();
      render();
    });
    $('btn-resumo').addEventListener('click', function () { resumoOn = true; renderResumo(); });
    $('resumo-copy').addEventListener('click', function () {
      var msg = $('resumo-msg');
      copyText(resumoMarkdown()).then(
        function () { msg.textContent = 'Resumo copiado como Markdown.'; },
        function () { msg.textContent = 'Não foi possível copiar automaticamente.'; }
      );
    });
    render();
  }

  /* ---------- Diário de bordo ---------- */
  var STORAGE_KEY = 'amparo-diario';

  var BASE_ENTRIES = [
    { quando: '07/11/2026 09:59', tag: 'Intenção',
      texto: 'Primeira pergunta: como se preparar para o Hackathon da USP. Resultado: checklist geral (time, ferramentas, MVP, pitch).' },
    { quando: '07/11/2026 12:01', tag: 'Descoberta',
      texto: 'Tema do desafio recebido pelo slide: "Saúde para todos: soluções para reduzir barreiras no acesso à saúde". O foco do evento é criar um modelo.' },
    { quando: '07/11/2026 12:19', tag: 'Decisão',
      texto: 'Primeiro foco: unidade móvel de prevenção no interior (D1 a D3, depois substituídas). O documento foi organizado em intenção, dores, pesquisa, objetivos, requisitos, métricas, lab de UI, decisões, workflow e diário.' },
    { quando: '07/11/2026 13:56', tag: 'Decisão',
      texto: 'Tema afunilado para transporte de pacientes em hemodiálise no interior. Em seguida o time reenquadrou o projeto como empresa de rotas e agendamentos para frotas (RotaSaúde), com prioridade e menor tempo de translocação. Essa fase ficou registrada no histórico do repositório (decisões D10 a D21).' },
    { quando: '07/11/2026 (tarde)', tag: 'Descoberta',
      texto: 'O orientador do hackathon avaliou que a ideia de rotas para hemodiálise não era boa e recomendou trocar o tema. O time explorou alternativas: baixo letramento em saúde, acessibilidade (Libras e deficiência visual) e ideias de startup no estilo do Capim, onde o pagador e o balcão precisam ser claros.' },
    { quando: '07/11/2026 16:38', tag: 'Intenção',
      texto: 'Nova ideia do time: pessoas que reduzem o trabalho por causa do tratamento deixam de se tratar para ajudar nas contas de casa. Proposta inicial: linha de crédito durante a recuperação.' },
    { quando: '07/11/2026 16:55', tag: 'Pesquisa',
      texto: 'Avaliação do crédito: risco de endividar quem perdeu renda e exposição à Lei do Superendividamento. Reformulação para um navegador de renda e direitos. Dado de apoio: cerca de metade dos pedidos de benefício por incapacidade foi negada no 1º semestre de 2026 (fontes divergem em alguns pontos).' },
    { quando: '07/11/2026 17:15', tag: 'Decisão',
      texto: 'Foco restrito ao saque do FGTS por diagnóstico, sem a hemodiálise. Correção registrada: a lei lista câncer, HIV, estágio terminal e doenças raras; listas mais longas (como nefropatia grave) vêm de fontes secundárias e não foram confirmadas.' },
    { quando: '07/11/2026 17:39', tag: 'Decisão',
      texto: 'Seguradoras descartadas como pagadoras. Motivos: cobertura parcial temporária de até 24 meses para doença preexistente (suspende cirurgias, leitos de alta tecnologia e procedimentos de alta complexidade ligados à doença) e a vedação da LGPD ao uso de dado de saúde para seleção de riscos. Alternativas hipotéticas: empresas, hospitais, programas de apoio ao paciente.' },
    { quando: '07/11/2026 17:45', tag: 'Descoberta',
      texto: 'Escalonamento pensado como cunha e plataforma: FGTS, depois INSS, BPC, IR, condições fora da lista, novos canais e eventos de vida. Roteiro por fases registrado em um Claude Doc.' },
    { quando: '07/11/2026 17:55', tag: 'Intenção',
      texto: 'Definição do produto: plataforma de assistência social e proteção financeira integrada à jornada do paciente hospitalar. Modelo de negócio: SaaS B2B, com o hospital pagando assinatura. Quatro módulos: calculadora de vulnerabilidade financeira, identificador de direitos, organizador documental e painel da assistente social.' },
    { quando: '07/11/2026 18:10', tag: 'Entrega',
      texto: 'Documento reorganizado para o novo produto, mantendo as 10 seções. Lab de UI com os quatro módulos sobre pacientes fictícios. Regras e pesos são hipóteses a validar, e o índice de vulnerabilidade não é validado.' }
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
    var linhas = ['# Diário de bordo · Amparo (Hackathon USP 2026)', ''];
    BASE_ENTRIES.concat(lerExtras()).forEach(function (e) {
      linhas.push('- **' + e.quando + ' · ' + e.tag + '** — ' + e.texto);
    });
    return linhas.join('\n') + '\n';
  }

  function say(msg) {
    var e = $('diary-msg');
    if (e) e.textContent = msg;
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