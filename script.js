// Simulador do valor de uma parada (valores ilustrativos).
// valor = elegíveis × lacuna × P(comparecer) × ganho
(function () {
  var elegiveis = document.getElementById('in-elegiveis');
  var lacuna = document.getElementById('in-lacuna');
  var adesao = document.getElementById('in-adesao');
  var ganho = document.getElementById('in-ganho');

  if (!elegiveis || !lacuna || !adesao || !ganho) return;

  var outElegiveis = document.getElementById('out-elegiveis');
  var outLacuna = document.getElementById('out-lacuna');
  var outAdesao = document.getElementById('out-adesao');
  var outGanho = document.getElementById('out-ganho');
  var resPessoas = document.getElementById('res-pessoas');
  var resValor = document.getElementById('res-valor');

  function update() {
    var e = Number(elegiveis.value);
    var l = Number(lacuna.value) / 100;
    var a = Number(adesao.value) / 100;
    var g = Number(ganho.value);

    // Pessoas esperadas: elegíveis na lacuna que comparecem.
    var pessoas = e * l * a;
    var valor = pessoas * g;

    outElegiveis.textContent = e;
    outLacuna.textContent = lacuna.value + '%';
    outAdesao.textContent = adesao.value + '%';
    outGanho.textContent = g;

    resPessoas.textContent = pessoas.toFixed(1).replace('.', ',');
    resValor.textContent = valor.toFixed(1).replace('.', ',');
  }

  [elegiveis, lacuna, adesao, ganho].forEach(function (el) {
    el.addEventListener('input', update);
  });

  update();
})();