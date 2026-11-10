# Especificação v1 — refatoração completa

> Pedido original enviado em 10/11/2026. Texto preservado como foi escrito.

Aja como um desenvolvedor especialista em jogos HTML5 Canvas 2D e Pixel Art. Preciso refatorar e aprimorar completamente o código do nosso jogo baseado na Alegoria da Caverna de Platão: "A Ilusão (O Interior da Caverna)".

Reescreva e corrija o jogo mantendo toda a estrutura em um único código executável (HTML/CSS/JS puro em Canvas), aplicando as seguintes especificações de narrativa, mecânicas, correções de bugs e visual:

---

### 🎨 1. MELHORIAS VISUAIS E DE IU (INTERFACE DE USUÁRIO)
* **Pixel Art Aprimorada:** Melhore a qualidade geral do desenho em Canvas. Use paletas de cores harmônicas (tons escuros de pedra na caverna, luzes quentes na fogueira, contraste forte de luz solar no final e um exterior vibrante).
* **Textura da Caverna:** Refaça a textura das paredes e da boca/saída da caverna para dar um aspecto mais orgânico e bem acabado.
* **Tela Inicial / Tutorial:** Crie uma tela de início limpa com o título do jogo e um painel de controles bem organizado e fácil de ler:
  - `[E]` : Interagir / Quebrar correntes
  - `[Setas / A-D]` : Mover
  - `[Espaço / W]` : Pular
  - `[Mouse / Teclado]` : Selecionar / Ações

---

### ⚙️ 2. MÁQUINA DE ESTADOS E FLUXO DOS 5 CENÁRIOS

#### 🟢 CENÁRIO 1: As Correntes e a Fagulha (Fase 1)
* **Cenário:** Caverna escura. Três prisioneiros acorrentados de costas para o fundo (o personagem principal "Code" no meio e mais 2 NPCs prisioneiros ao lado). Eles observam um muro onde sombras são projetadas.
* **Mecânica de Libertação (REFEITA):**
  1. Ao lado do personagem principal, há uma **pedra em destaque com efeito de brilho/pulsação (glowing pixel art)**.
  2. O jogador interage com a pedra para pegá-la.
  3. Ao pegar a pedra, surge um texto flutuante/dialogo indicando: **"Pressione E para se libertar"**.
  4. Ao pressionar E, inicia-se um **Quick Time Event (QTE)** simples de 3 rodadas consecutivas (ex: acertar a tecla indicada ou pressionar no momento certo com barra de progresso visual).
  5. Ao vencer o QTE de 3 rodadas, o personagem bate com a pedra nas algemas e se liberta.
* **⚠️ CORREÇÃO DE BUG CRÍTICA:** Mantenha estritamente a mesma escala do sprite do personagem. Corrija o bug onde o personagem principal ficava pequeno após se soltar das correntes. O tamanho dele deve ser 100% consistente ao se levantar.

#### 🟢 CENÁRIO 2: Os Primeiros Passos e a Fogueira (Fase 2)
* **Cenário:** O personagem recém-liberto tenta ficar em pé.
* **Mecânica de Movimento:**
  1. Ao tentar andar sozinho pela primeira vez, o personagem perde o equilíbrio e cai no chão (já que nunca andou na vida).
  2. Para conseguir andar, o jogador precisa se apoiar/segurar na parede (segurando uma tecla ou caminhando encostado na parede) até recuperar a firmeza e conseguir andar normalmente.
* **A Descoberta:** Após passar pelo muro, o personagem descobre a fogueira e as estátuas/objetos que projetavam as sombras. Exiba uma breve animação/expressão de choque/incrédulo pela verdade. O jogador caminha passando por elas.

#### 🟢 CENÁRIO 3: O Parkour da Caverna (Fase 3)
* **Cenário:** Seção de plataforma vertical/horizontal após as estátuas. No fundo da tela, há várias estacas de pedra pontudas (espinhos) ameaçadoras.
* **Mecânica & Correções de Parkour:**
  1. Melhore a física de pulo (gravidade ajustada, pulo fluido sem travar nas bordas das plataformas).
  2. Corrija colisões e bugs de atravessar plataformas ou grudar em paredes.
  3. O jogador deve pular com precisão entre os obstáculos para chegar à parte superior direita (boca da caverna). Se cair nas estacas, a fase 3 reinicia.

#### 🟢 CENÁRIO 4: A Revelação e o Ofuscamento (Fase 4)
* **Cenário:** O personagem alcança a abertura/saída da caverna (com a nova textura de saída aprimorada).
* **Mecânica:** Ao tentar caminhar em direção ao exterior, a luz do sol brilha intensamente (efeito de transição flash/whiteout em tela).
* O personagem fica temporariamente cego pela luz forte (nunca viu o sol), cambaleia e desmaia no chão. A tela faz um fade para o preto.

#### 🟢 CENÁRIO 5: O Mundo Exterior e o Loop (Fase 5 / Final)
* **Cenário:** O personagem acorda do lado de fora da caverna.
* Visual vibrante e bonito: árvores em pixel art, animais, uma cachoeira ao fundo e montanhas (o "mundo real/paraíso").
* **Mecânica:** O jogador toma o controle e caminha para a frente para admirar o mundo com mais clareza.
* **O Plot Twist / Loop:** O personagem não percebe que a saída da caverna fica no topo de um precipício. Ao dar mais alguns passos em direção à vista, ele cai no abismo.
* A tela escurece totalmente (Fade to Black) com uma mensagem filosófica reflexiva e o jogo **reinicia automaticamente do Cenário 1 (Loop)**, simulando o ciclo do mito.

---

Garanta um código limpo, comentado, performance fluida a 60 FPS, sem dependências de arquivos externos de imagem (tudo renderizado em Canvas/JS).