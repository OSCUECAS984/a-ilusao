# A Ilusão · O Interior da Caverna

Jogo 2D em pixel art baseado na **Alegoria da Caverna** de Platão (*A República*, Livro VII).
Feito em HTML5 Canvas puro, num único arquivo, sem imagens nem sons externos: toda a arte é desenhada em código e toda a trilha é sintetizada com a Web Audio API.

> **Repositório privado.** Serve de backup e organização do projeto até a primeira versão pública.

Versão atual: **v3.1.1** · veja o [CHANGELOG](CHANGELOG.md).

---

## Como jogar

Abra `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox, Safari). Funciona offline. Sem internet, as fontes do Google Fonts caem para uma fonte monoespaçada e o resto do jogo continua igual.

A música começa no primeiro clique ou toque, porque os navegadores bloqueiam som antes disso.

### Controles

| Tecla | Ação |
|---|---|
| `←` `→` ou `A` `D` | Andar e escolher |
| `Espaço` ou `W` | Pular (segure para ir mais alto) |
| `E` | Interagir · Examinar · Quebrar correntes |
| segure `E` | Apoiar-se na parede (Cenário II) |
| `S` / `N` | Responder Sim ou Não |
| `Enter` ou clique | Avançar diálogo |
| `M` | Ligar ou desligar o som |

No celular aparecem botões de toque abaixo da tela.

### A jornada

| Cenário | Nome | O que acontece |
|---|---|---|
| I | As Correntes e a Fagulha | Code está acorrentado com dois prisioneiros (o Místico e o Arrogante). Converse com eles, pegue a pedra brilhante e acerte 3 golpes seguidos (QTE) para quebrar as algemas. |
| II | Os Primeiros Passos e a Fogueira | Code cai na primeira tentativa de andar. Segure `E` para se apoiar na parede até encher a Firmeza. Depois do muro, descobre as estátuas e a fogueira. Tocar no fogo queima. |
| III | O Parkour da Caverna | Plataformas fixas e móveis sobre estacas. Cair nas estacas reinicia a fase. A saída é a luz no alto, à direita. |
| IV | A Revelação e o Ofuscamento | A luz do sol cega Code, que cambaleia e desmaia. A trilha muda da caverna para a natureza. |
| V | O Mundo Exterior | Exploração livre com animais, rio, cachoeira, vila e o sol. Ao se aproximar demais da vista, Code cai do precipício e o ciclo recomeça no Cenário I. |

Objetos com o ícone **?** podem ser examinados com `E`.

Para voltar à fase anterior, encoste na borda esquerda e segure `←` (não vale no Mundo Exterior).

---

## Estrutura do repositório

```
index.html                 o jogo completo (arquivo único gerado a partir de src/)
build.sh                   junta src/ em index.html
src/
  01-interface.html        HTML e CSS: tela inicial, HUD, diálogo, QTE, toque
  02-nucleo-e-sprites.js   primitivas de pixel, paletas, sprites do Code, NPCs, estátuas, animais, retratos
  03-mapas.js              construção dos cenários: câmara, salão, parkour, boca da caverna, exterior
  04-audio-entrada-ui.js   trilha e efeitos (Web Audio), teclado/toque, diálogo com retrato e escolhas
  05-cenas-e-laco.js       física, iluminação, inspeção, lógica dos 5 cenários, final e laço de 60 FPS
docs/
  especificacao-v1.md      pedido original da refatoração
  especificacao-v2.md      pedido da v2 (imersão, narrativa e áudio)
  referencias/             imagens de referência visual dos cenários
CHANGELOG.md               histórico de versões
```

## Como editar

1. Edite os arquivos em `src/`.
2. Rode `./build.sh` para gerar o `index.html` atualizado.
3. Abra `index.html` no navegador para testar.

Se preferir editar o `index.html` direto, lembre que o próximo `./build.sh` sobrescreve essas mudanças. Nesse caso, copie a alteração de volta para o arquivo certo em `src/`.

### Detalhes técnicos

- Resolução interna de 384×216 px, ampliada sem suavização (`image-rendering: pixelated`).
- Todos os sprites do Code são desenhados na mesma escala e ancorados nos pés, o que evita o antigo bug de o personagem encolher ao se levantar.
- Física com colisão por eixo em subpassos de 1/240 s, correção de cantos, *coyote time* e pulo de altura variável.
- Iluminação por mapa de escuridão em meia resolução, que dá à luz um aspecto de pixel art.
- O ciclo atual fica salvo no navegador (`localStorage`).

---

## Referências visuais

As imagens em `docs/referencias/` serviram de base para os cenários. A figura adulta que aparece em `04-mundo-exterior.png` **não** faz parte do jogo, por decisão da equipe.

## Créditos

- Ideia, roteiro e direção: equipe do projeto **Jogo FILOSOFIA**.
- Código e pixel art gerados com Claude (Anthropic), a partir das especificações da equipe.
- Inspiração: Platão, *A República*, Livro VII.

## Licença

Todos os direitos reservados até a equipe decidir a licença da versão pública.
