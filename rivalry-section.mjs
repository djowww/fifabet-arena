// Original editorial illustrations for the arena. Values and score are examples,
// never a wallet balance, a verified match or an enabled payment flow.
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function controller(variant){
  const pale=variant==='away';
  return `<g class='rivalry-controller ${pale?'rivalry-controller-away':''}' transform='${pale?'translate(200 80) rotate(12 68 48)':'translate(18 88) rotate(-12 68 48)'}'>
    <path d='M34 13h68c14 0 22 10 25 25l9 44c3 17-13 24-24 11l-15-17H39L23 94C12 106-4 98 1 80l9-42c3-15 11-25 24-25Z' fill='${pale?'url(#rivalryPadWhite)':'url(#rivalryPadDark)'}' stroke='${pale?'#c5d3cb':'#697f70'}' stroke-width='1.5'/>
    <path d='M31 11 35 5h22l2 8m17 0 3-8h22l5 8' fill='${pale?'#b8c4be':'#4a5c50'}'/>
    <path d='M58 24h23l-3 25H60Z' fill='${pale?'#919f98':'#122b1b'}' stroke='${pale?'#798d81':'#4b7258'}'/>
    <path d='M24 31h9v8h8v9h-8v8h-9v-8h-8v-9h8Z' fill='${pale?'#26382d':'#07f468'}' stroke='${pale?'#142319':'#81ffaa'}' stroke-width='.8'/>
    <circle cx='46' cy='67' r='14' fill='#101c14' stroke='${pale?'#7d9586':'#4b7258'}' stroke-width='2'/><circle cx='46' cy='67' r='9' fill='#273d2d' stroke='#697c70'/>
    <circle cx='88' cy='68' r='14' fill='#101c14' stroke='${pale?'#7d9586':'#4b7258'}' stroke-width='2'/><circle cx='88' cy='68' r='9' fill='#273d2d' stroke='#697c70'/>
    <g fill='${pale?'#07f468':'#d6ebe0'}' stroke='${pale?'#172d20':'#4b7258'}'><circle cx='108' cy='30' r='4.7'/><circle cx='119' cy='41' r='4.7'/><circle cx='108' cy='52' r='4.7'/><circle cx='97' cy='41' r='4.7'/></g>
    <path d='m57 57 22 .2' stroke='${pale?'#778c7f':'#07f468'}' stroke-width='1.5'/><circle cx='68' cy='66' r='2.5' fill='${pale?'#344e3d':'#07f468'}'/>
    <path d='m15 71-4 14m111-14 3 14' stroke='${pale?'#d8e1dd':'#5a7463'}' stroke-width='3' stroke-linecap='round'/>
  </g>`;
}

function duelArt(){
  return `<svg class='rivalry-duel-art' viewBox='0 0 360 225' aria-hidden='true' focusable='false'>
    <defs><linearGradient id='rivalryPadDark' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#425a4b'/><stop offset='.45' stop-color='#22362a'/><stop offset='1' stop-color='#101e15'/></linearGradient><linearGradient id='rivalryPadWhite' x1='0' y1='0' x2='.3' y2='1'><stop stop-color='#eef5f0'/><stop offset='.6' stop-color='#baccc0'/><stop offset='1' stop-color='#7c9688'/></linearGradient><radialGradient id='rivalryPitchGlow'><stop stop-color='#07f468' stop-opacity='.22'/><stop offset='1' stop-color='#07f468' stop-opacity='0'/></radialGradient></defs>
    <ellipse cx='180' cy='146' rx='177' ry='76' fill='url(#rivalryPitchGlow)'/>
    <path d='M70 107h220l50 109H20Z' fill='#07f468' fill-opacity='.025' stroke='#5b8067' stroke-opacity='.45'/><path d='M180 107v109M41 170h278' stroke='#5b8067' stroke-opacity='.45'/><ellipse cx='180' cy='170' rx='40' ry='14' fill='none' stroke='#5b8067' stroke-opacity='.45'/><path d='m113 107-11 20h156l-11-20M115 216l-6-19h142l-6 19' fill='none' stroke='#5b8067' stroke-opacity='.45'/>
    <path d='m207 52-54 126' stroke='#07f468' stroke-width='2' stroke-opacity='.7'/><path d='m213 52-54 126' stroke='#07f468' stroke-opacity='.15' stroke-width='7'/>
    <ellipse cx='86' cy='202' rx='65' ry='8' fill='#070c09' fill-opacity='.65'/><ellipse cx='273' cy='206' rx='66' ry='8' fill='#070c09' fill-opacity='.65'/>
    ${controller('home')}${controller('away')}
  </svg>`;
}

function stakeArt(){
  return `<div class='rivalry-stake-art'>
    <svg class='rivalry-money-lines' viewBox='0 0 360 225' aria-hidden='true' focusable='false'><circle cx='302' cy='60' r='50' fill='none' stroke='currentColor' stroke-opacity='.13' stroke-width='1.5'/><circle cx='302' cy='60' r='35' fill='none' stroke='currentColor' stroke-opacity='.13'/><path d='m238 40 98 111-59 52-98-111Z' fill='none' stroke='currentColor' stroke-opacity='.13' stroke-width='2'/><path d='m22 143 76-79 67 65-76 78Z' fill='none' stroke='currentColor' stroke-opacity='.13' stroke-width='2'/><path d='M20 203h320M35 218h290' stroke='currentColor' stroke-opacity='.13'/><path d='m274 18 1 15m-8-7h15M25 79v15m-7-7h15' stroke='currentColor' stroke-opacity='.35' stroke-width='1.5'/></svg>
    <span class='rivalry-stake-caption'>PRÊMIO COMBINADO · EXEMPLO</span>
    <div class='rivalry-stake-value'><span>R$</span><strong>100</strong></div>
    <div class='rivalry-stake-split'><span>Você <b>R$ 50</b></span><i aria-hidden='true'>+</i><span>Seu amigo <b>R$ 50</b></span></div>
  </div>`;
}

function evidenceArt(icon){
  return `<div class='rivalry-evidence-art'><svg class='rivalry-result-screen' viewBox='0 0 360 225' aria-hidden='true' focusable='false'>
    <path d='M18 37V22h18m288 0h18v15M18 188v15h18m288 0h18v-15' fill='none' stroke='#718579' stroke-width='1.5'/>
    <rect x='31' y='38' width='298' height='146' rx='7' fill='#101915' stroke='#52675b'/><path d='M38 45h284v131H38Z' fill='#17271d'/><path d='M38 69h284M180 69v107M38 142h284' fill='none' stroke='#54715d' stroke-opacity='.25'/><ellipse cx='180' cy='143' rx='47' ry='15' fill='none' stroke='#54715d' stroke-opacity='.25'/>
    <text x='180' y='59' text-anchor='middle' fill='#a9c3b1' font-size='8' font-family='Arial,sans-serif' letter-spacing='2'>PARTIDA ENTRE AMIGOS</text>
    <path d='m62 81 35-9 35 9v24c0 29-35 43-35 43s-35-14-35-43Z' fill='#254b34' stroke='#85c599' stroke-width='1.5'/><path d='m231 81 35-9 35 9v24c0 29-35 43-35 43s-35-14-35-43Z' fill='#293e35' stroke='#9eb0a6' stroke-width='1.5'/>
    <path d='m97 87 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z' fill='#07f468'/><path d='m266 87 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1Z' fill='#c3d4ca'/>
    <text x='180' y='126' text-anchor='middle' fill='#f5faf7' font-size='42' font-weight='800' font-family='Arial,sans-serif' letter-spacing='-2'>3 : 2</text>
    <text x='97' y='166' text-anchor='middle' fill='#d0dfd5' font-size='9' font-family='Arial,sans-serif' letter-spacing='1'>VOCÊ</text><text x='266' y='166' text-anchor='middle' fill='#d0dfd5' font-size='9' font-family='Arial,sans-serif' letter-spacing='1'>SEU AMIGO</text>
  </svg><span class='rivalry-evidence-status'>${icon('clock')}Resultado em revisão</span><span class='rivalry-evidence-caption'>CAPTURA ILUSTRATIVA</span></div>`;
}

export function renderRivalrySection({icon=()=>'',fcLogo=''}={}){
  const logo=fcLogo?`<img class='rivalry-fc-logo' src='${escape(fcLogo)}' alt='EA SPORTS FC' width='160' height='76' loading='lazy'>`:`<strong class='rivalry-fc-fallback'>EA SPORTS FC</strong>`;
  return `<section class='rivalry-section' aria-labelledby='rivalryTitle'>
    <div class='rivalry-heading'><div><p class='eyebrow'>O JOGO É ENTRE VOCÊS</p><h2 id='rivalryTitle'>Seu amigo. Seu rival.<br><em>Vale quanto?</em></h2></div><p>O clássico sai da conversa<br>e entra em campo.</p></div>
    <div class='rivalry-grid'>
      <article class='rivalry-card rivalry-game'><div class='rivalry-card-top'><span>01 / O CONFRONTO</span><span>1V1</span></div><div class='rivalry-art-stage rivalry-game-stage'>${logo}<span class='rivalry-duel-vs' aria-hidden='true'>VS</span>${duelArt()}</div><div class='rivalry-card-copy'><p class='rivalry-card-kicker'>EA SPORTS FC · ENTRE AMIGOS</p><h3>O próximo rival<br>já está nos seus contatos.</h3><p>Escolham os times, o modo de jogo e as regras. A amizade continua. A rivalidade começa.</p></div><div class='rivalry-card-bottom'><span>${icon('gamepad')}A decisão é no controle.</span></div></article>
      <article class='rivalry-card rivalry-wager'><div class='rivalry-card-top'><span>02 / O VALOR</span><span>EXEMPLO</span></div><div class='rivalry-art-stage'>${stakeArt()}</div><div class='rivalry-card-copy'><p class='rivalry-card-kicker'>R$ 50 POR JOGADOR · R$ 100 NO TOTAL</p><h3>Não é só<br>pela resenha.</h3><p>A proposta: apostar com seu amigo, combinar o valor antes da partida e deixar o futebol decidir.</p></div><div class='rivalry-card-bottom'><span>${icon('users')}Dois amigos. Um combinado.</span></div></article>
      <article class='rivalry-card rivalry-review'><div class='rivalry-card-top'><span>03 / O RESULTADO</span><span>FAIR PLAY</span></div><div class='rivalry-art-stage'>${evidenceArt(icon)}</div><div class='rivalry-card-copy'><p class='rivalry-card-kicker'>PLACAR + FOTO DO RESULTADO</p><h3>O apito final<br>pede evidência.</h3><p>Registre o placar e envie uma foto. Se houver divergência, sinalize fraude e mantenha o resultado em revisão.</p></div><div class='rivalry-card-bottom'><span>${icon('shield')}A rivalidade merece jogo limpo.</span></div></article>
    </div>
    <div class='rivalry-bottom'><p class='rivalry-prototype-note'>Valores e placar ilustrativos. Dinheiro real é uma proposta para uma versão futura. Este protótipo funciona apenas com pontos fictícios, sem valor financeiro.</p><div class='rivalry-actions'><button class='btn primary' data-route='amigos'>Chamar meu rival ${icon('arrow')}</button><button class='btn secondary' data-action='help'>Como funciona ${icon('arrow')}</button></div></div>
  </section>`;
}
