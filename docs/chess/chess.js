document.addEventListener('DOMContentLoaded', () => {

    // === Tile ===
    class Tile {
        constructor(row, col, piece = null) {
            this.row = row;
            this.col = col;
            this.piece = piece;
            this.element = null;
            this.enPassant = false;
        }
    }

    // === Piece (Basis) ===
    class Piece {
        constructor(color, tile) {
            this.color = color;
            this.tile = tile;
            this.firstMove = true;
        }
        getImageName() {
            return `${this.constructor.name.toLowerCase()}-${this.color.charAt(0)}`;
        }
        getValidMoves(board) { return []; }
        getAttackMoves(board) { return this.getValidMoves(board); }
    }

    // === Pawn ===
    class Pawn extends Piece {
        getValidMoves(board) {
            const dir = this.color === 'white' ? -1 : 1;
            const moves = [];
            const row = this.tile.row;
            const col = this.tile.col;

            // forward
            if (board.getTile(row + dir, col)?.piece === null) {
                moves.push([row + dir, col]);
                if (this.firstMove && board.getTile(row + 2 * dir, col)?.piece === null) {
                    moves.push([row + 2 * dir, col]);
                }
            }
            // captures
            for (let dc of [-1, 1]) {
                const target = board.getTile(row + dir, col + dc);
                if (target && target.piece && target.piece.color !== this.color) {
                    moves.push([row + dir, col + dc]);
                }
            }
            // en passant
            for (let dc of [-1, 1]) {
                const target = board.getTile(row, col + dc);
                if (target && target.enPassant) {
                    moves.push([row + dir, col + dc]);
                }
            }
            return moves;
        }
    }

    // === Rook ===
    class Rook extends Piece {
        getValidMoves(board) {
            return slideMoves(this, board, [[1,0],[-1,0],[0,1],[0,-1]]);
        }
    }

    // === Bishop ===
    class Bishop extends Piece {
        getValidMoves(board) {
            return slideMoves(this, board, [[1,1],[1,-1],[-1,1],[-1,-1]]);
        }
    }

    // === Queen ===
    class Queen extends Piece {
        getValidMoves(board) {
            return slideMoves(this, board, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
        }
    }

    // === Knight ===
    class Knight extends Piece {
        getValidMoves(board) {
            const deltas = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
            return jumpMoves(this, board, deltas);
        }
    }

    // === King ===
    class King extends Piece {
        getValidMoves(board) {
            const deltas = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            const moves = jumpMoves(this, board, deltas);

            // Castling
            if (this.firstMove && !board.isCheck(this.tile.row, this.tile.col, this.color)) {
                // Kingside
                const rookTile = board.getTile(this.tile.row, 7);
                if (rookTile && rookTile.piece instanceof Rook && rookTile.piece.firstMove) {
                    if (!board.getTile(this.tile.row, 5).piece && !board.getTile(this.tile.row, 6).piece) {
                        moves.push([this.tile.row, this.tile.col + 2]);
                    }
                }
                // Queenside
                const rookTile2 = board.getTile(this.tile.row, 0);
                if (rookTile2 && rookTile2.piece instanceof Rook && rookTile2.piece.firstMove) {
                    if (!board.getTile(this.tile.row, 1).piece && !board.getTile(this.tile.row, 2).piece && !board.getTile(this.tile.row, 3).piece) {
                        moves.push([this.tile.row, this.tile.col - 2]);
                    }
                }
            }
            return moves;
        }

        // ✅ kein Castling hier → verhindert Endlosschleife in isCheck()
        getAttackMoves(board) {
            const deltas = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            return jumpMoves(this, board, deltas);
        }
    }

    // === Hilfsfunktionen für Züge ===
    function slideMoves(piece, board, directions) {
        const moves = [];
        for (let [dr, dc] of directions) {
            let r = piece.tile.row + dr, c = piece.tile.col + dc;
            while (true) {
                const t = board.getTile(r, c);
                if (!t) break;
                if (!t.piece) {
                    moves.push([r, c]);
                } else {
                    if (t.piece.color !== piece.color) moves.push([r, c]);
                    break;
                }
                r += dr; c += dc;
            }
        }
        return moves;
    }

    function jumpMoves(piece, board, deltas) {
        const moves = [];
        for (let [dr, dc] of deltas) {
            const t = board.getTile(piece.tile.row + dr, piece.tile.col + dc);
            if (t && (!t.piece || t.piece.color !== piece.color)) {
                moves.push([t.row, t.col]);
            }
        }
        return moves;
    }

    // === Board ===
    class Board {
        constructor() {
            this.grid = Array.from({length:8}, (_,i)=>Array.from({length:8},(_,j)=>new Tile(i,j)));
            this.lastMove = null;
            this.setupPieces();
        }
        getTile(r,c) {
            if (r<0||r>7||c<0||c>7) return null;
            return this.grid[r][c];
        }
        setupPieces() {
            // Black
            this.grid[0][0].piece = new Rook('black', this.grid[0][0]);
            this.grid[0][1].piece = new Knight('black', this.grid[0][1]);
            this.grid[0][2].piece = new Bishop('black', this.grid[0][2]);
            this.grid[0][3].piece = new Queen('black', this.grid[0][3]);
            this.grid[0][4].piece = new King('black', this.grid[0][4]);
            this.grid[0][5].piece = new Bishop('black', this.grid[0][5]);
            this.grid[0][6].piece = new Knight('black', this.grid[0][6]);
            this.grid[0][7].piece = new Rook('black', this.grid[0][7]);
            for (let i=0;i<8;i++) this.grid[1][i].piece = new Pawn('black', this.grid[1][i]);

            // White
            this.grid[7][0].piece = new Rook('white', this.grid[7][0]);
            this.grid[7][1].piece = new Knight('white', this.grid[7][1]);
            this.grid[7][2].piece = new Bishop('white', this.grid[7][2]);
            this.grid[7][3].piece = new Queen('white', this.grid[7][3]);
            this.grid[7][4].piece = new King('white', this.grid[7][4]);
            this.grid[7][5].piece = new Bishop('white', this.grid[7][5]);
            this.grid[7][6].piece = new Knight('white', this.grid[7][6]);
            this.grid[7][7].piece = new Rook('white', this.grid[7][7]);
            for (let i=0;i<8;i++) this.grid[6][i].piece = new Pawn('white', this.grid[6][i]);
        }
        movePiece(move) {
            const {startRow,startCol,endRow,endCol} = move;
            const startTile = this.getTile(startRow,startCol);
            const endTile = this.getTile(endRow,endCol);
            const piece = startTile.piece;

            // En passant
            if (piece instanceof Pawn && endTile.enPassant) {
                const capTile = this.getTile(startRow,endCol);
                capTile.piece = null;
            }

            // Castling
            if (piece instanceof King && Math.abs(endCol - startCol) === 2) {
                if (endCol === 6) { // kingside
                    const rookTile = this.getTile(startRow,7);
                    const rook = rookTile.piece;
                    this.getTile(startRow,5).piece = rook;
                    rook.tile = this.getTile(startRow,5);
                    rookTile.piece = null;
                } else { // queenside
                    const rookTile = this.getTile(startRow,0);
                    const rook = rookTile.piece;
                    this.getTile(startRow,3).piece = rook;
                    rook.tile = this.getTile(startRow,3);
                    rookTile.piece = null;
                }
            }

            endTile.piece = piece;
            startTile.piece = null;
            piece.tile = endTile;
            piece.firstMove = false;

            this.grid.flat().forEach(t => t.enPassant = false);
            if (piece instanceof Pawn && Math.abs(startRow - endRow) === 2) {
                this.getTile((startRow+endRow)/2, startCol).enPassant = true;
            }

            this.lastMove = move;
        }

        getKing(color) {
            return this.grid.flat().map(t=>t.piece).find(p=>p instanceof King && p.color===color);
        }
        isCheck(r,c,color) {
            const opp = color==='white'?'black':'white';
            for (let i=0;i<8;i++) {
                for (let j=0;j<8;j++) {
                    const p = this.getTile(i,j).piece;
                    if (p && p.color===opp) {
                        if (p.getAttackMoves(this).some(([rr,cc])=>rr===r && cc===c)) return true;
                    }
                }
            }
            return false;
        }
        isCheckmate(color) {
            const king = this.getKing(color);
            if (!this.isCheck(king.tile.row,king.tile.col,color)) return false;
            return ai.getAllMoves(this,color).length===0;
        }
        isStalemate(color) {
            const king = this.getKing(color);
            if (this.isCheck(king.tile.row,king.tile.col,color)) return false;
            return ai.getAllMoves(this,color).length===0;
        }
    }

    // === AI ===
    class AI {
        constructor() {
            this.pieceValues = {pawn:10,knight:30,bishop:30,rook:50,queen:90,king:900};
        }
        evaluateBoard(board) {
            let score=0;
            for (let i=0;i<8;i++) {
                for (let j=0;j<8;j++) {
                    const p = board.getTile(i,j).piece;
                    if (p) {
                        const v = this.pieceValues[p.constructor.name.toLowerCase()]||0;
                        score += p.color==='white'?v:-v;
                    }
                }
            }
            return score;
        }
        getAllMoves(board,color) {
            const all=[];
            for (let i=0;i<8;i++) {
                for (let j=0;j<8;j++) {
                    const p=board.getTile(i,j).piece;
                    if (p && p.color===color) {
                        for (const [r,c] of p.getValidMoves(board)) {
                            all.push({piece:p,startRow:i,startCol:j,endRow:r,endCol:c});
                        }
                    }
                }
            }
            return all;
        }
        getBestMove(board) {
            const moves=this.getAllMoves(board,'black');
            let best=null, bestVal=Infinity;
            for (const m of moves) {
                const captured=board.getTile(m.endRow,m.endCol).piece;
                board.movePiece(m);
                const val=this.evaluateBoard(board);
                // undo
                const endT=board.getTile(m.endRow,m.endCol);
                const startT=board.getTile(m.startRow,m.startCol);
                startT.piece=m.piece;
                m.piece.tile=startT;
                endT.piece=captured;
                if (val<bestVal) {bestVal=val;best=m;}
            }
            return best;
        }
        makeMove(board) {
            const best=this.getBestMove(board);
            if(best) {
                board.movePiece(best);
                drawBoard();
                switchPlayer();
                updateGameState();
            }
        }
    }

    // === Variablen ===
    const boardElement=document.getElementById('chessboard');
    const turnIndicator=document.getElementById('turn-indicator');
    const gameStatus=document.getElementById('game-status');
    const resetBtn=document.getElementById('reset-button');
    const aiBtn=document.getElementById('ai-button');

    let board=new Board();
    let ai=new AI();
    let currentPlayer='white';
    let selectedTile=null;
    let aiEnabled=false;

    // === Rendering ===
    function drawBoard() {
        boardElement.innerHTML='';
        for(let i=0;i<8;i++) {
            for(let j=0;j<8;j++) {
                const tile=board.getTile(i,j);
                const div=document.createElement('div');
                div.className=`square ${(i+j)%2===0?'white':'black'}`;
                tile.element=div;
                div.addEventListener('click',()=>handleClick(tile));

                if(tile.piece) {
                    const img=document.createElement('img');
                    img.src=`chess/img/${tile.piece.getImageName()}.svg`; // ✅ Pfad fix
                    img.className='piece';
                    div.appendChild(img);
                }
                boardElement.appendChild(div);
            }
        }
    }

    function handleClick(tile) {
        if(currentPlayer!=='white') return;
        if(selectedTile) {
            const piece=selectedTile.piece;
            if(piece) {
                const valid=piece.getValidMoves(board).map(m=>`${m[0]},${m[1]}`);
                if(valid.includes(`${tile.row},${tile.col}`)) {
                    board.movePiece({piece,startRow:selectedTile.row,startCol:selectedTile.col,endRow:tile.row,endCol:tile.col});
                    drawBoard();
                    switchPlayer();
                    updateGameState();
                }
            }
            selectedTile=null;
        } else if(tile.piece && tile.piece.color===currentPlayer) {
            selectedTile=tile;
        }
    }

    function switchPlayer() {
        currentPlayer=currentPlayer==='white'?'black':'white';
        turnIndicator.textContent=`${currentPlayer.charAt(0).toUpperCase()+currentPlayer.slice(1)}'s Turn`;
        if(currentPlayer==='black' && aiEnabled) {
            setTimeout(()=>ai.makeMove(board),200);
        }
    }

    function updateGameState() {
        if(board.isCheckmate(currentPlayer)) {
            gameStatus.textContent=`${currentPlayer} checkmated!`;
        } else if(board.isStalemate(currentPlayer)) {
            gameStatus.textContent="Stalemate!";
        } else {
            const king=board.getKing(currentPlayer);
            if(board.isCheck(king.tile.row,king.tile.col,currentPlayer)) {
                gameStatus.textContent=`${currentPlayer} is in check!`;
            } else {
                gameStatus.textContent='';
            }
        }
    }

    resetBtn.addEventListener('click',()=>{
        board=new Board();
        currentPlayer='white';
        selectedTile=null;
        drawBoard();
        updateGameState();
        turnIndicator.textContent="White's Turn";
    });

    aiBtn.addEventListener('click',()=>{
        aiEnabled=!aiEnabled;
        aiBtn.textContent=`AI (Black): ${aiEnabled?'ON':'OFF'}`;
    });

    // Start
    drawBoard();
    updateGameState();

});
