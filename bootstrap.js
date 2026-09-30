const screen = document.getElementById("screen");

if (location.protocol === "file:") {
  screen.innerHTML =
    '<section class="file-start-card" role="status">' +
    '<p class="eyebrow">EXECUÇÃO LOCAL</p>' +
    '<h1>Abra a arena por um servidor local.</h1>' +
    '<p>O navegador bloqueia os módulos JavaScript quando este HTML é aberto diretamente.</p>' +
    '<ol><li>Abra o terminal nesta pasta.</li><li>Execute <code>node serve.mjs</code>.</li><li>Acesse <a href="http://127.0.0.1:4173">http://127.0.0.1:4173</a>.</li></ol>' +
    '</section>';
} else {
  const appScript = document.createElement("script");
  appScript.type = "module";
  appScript.src = document.currentScript?.dataset.app || "play.js";
  appScript.onerror = () => {
    screen.innerHTML =
      '<section class="card pad"><h1>Não foi possível carregar a arena.</h1>' +
      '<p>Confira a conexão e recarregue a página. Para executar no computador, use o servidor local.</p></section>';
  };
  document.body.append(appScript);
}
