document.addEventListener('DOMContentLoaded', () => {

    class Tile {
        constructor(row, col, piece = null) {
            this.row = row;
            this.col = col;
            this.piece = piece;
            this.element = null;
            this.enPassant = false;
        }
    }

    class Board {
        constructor() {
            this.grid = Array(8).fill(null).map((_, i) => Array(8).fill(null).map((_, j) => new Tile(i, j)));
            this.setupPieces();
            this.lastMove = null;
        }

        getTile(row, col) {
            if (row < 0 || row > 7 || col < 0 || col > 7) return null;
            return this.grid[row][col];
        }

        getKing(color) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = this.grid[i][j].piece;
                    if (piece instanceof King && piece.color === color) {
                        return piece;
                    }
                }
            }
        }

        setupPieces() {
            // Black pieces
            this.grid[0][0].piece = new Rook('black', this.grid[0][0]);
            this.grid[0][1].piece = new Knight('black', this.grid[0][1]);
            this.grid[0][2].piece = new Bishop('black', this.grid[0][2]);
            this.grid[0][3].piece = new Queen('black', this.grid[0][3]);
            this.grid[0][4].piece = new King('black', this.grid[0][4]);
            this.grid[0][5].piece = new Bishop('black', this.grid[0][5]);
            this.grid[0][6].piece = new Knight('black', this.grid[0][6]);
            this.grid[0][7].piece = new Rook('black', this.grid[0][7]);
            for (let i = 0; i < 8; i++) {
                this.grid[1][i].piece = new Pawn('black', this.grid[1][i]);
            }

            // White pieces
            this.grid[7][0].piece = new Rook('white', this.grid[7][0]);
            this.grid[7][1].piece = new Knight('white', this.grid[7][1]);
            this.grid[7][2].piece = new Bishop('white', this.grid[7][2]);
            this.grid[7][3].piece = new Queen('white', this.grid[7][3]);
            this.grid[7][4].piece = new King('white', this.grid[7][4]);
            this.grid[7][5].piece = new Bishop('white', this.grid[7][5]);
            this.grid[7][6].piece = new Knight('white', this.grid[7][6]);
            this.grid[7][7].piece = new Rook('white', this.grid[7][7]);
            for (let i = 0; i < 8; i++) {
                this.grid[6][i].piece = new Pawn('white', this.grid[6][i]);
            }
        }
        
        movePiece(move) {
            const { startRow, startCol, endRow, endCol } = move;
            const startTile = this.getTile(startRow, startCol);
            const endTile = this.getTile(endRow, endCol);
            const piece = startTile.piece;

            const capturedPiece = endTile.piece;
            const wasFirstMove = piece.firstMove;
            const lastEnPassant = this.grid.flat().find(t => t.enPassant)?.enPassant || false;

            // En Passant
            let enPassantCapture = null;
            if (piece instanceof Pawn && endTile.enPassant) {
                const capturedPawnTile = this.getTile(startRow, endCol);
                enPassantCapture = capturedPawnTile.piece;
                capturedPawnTile.piece = null;
            }

            // Castling
            let castlingRookMove = null;
            if (piece instanceof King) {
                const dx = endCol - startCol;
                if (Math.abs(dx) === 2) {
                    const rook = dx > 0 ? this.getTile(startRow, 7).piece : this.getTile(startRow, 0).piece;
                    const newRookCol = dx > 0 ? 5 : 3;
                    castlingRookMove = this.movePiece({startRow: rook.tile.row, startCol: rook.tile.col, endRow: startRow, endCol: newRookCol});
                }
            }

            endTile.piece = piece;
            startTile.piece = null;
            piece.tile = endTile;
            piece.firstMove = false;
            
            this.lastMove = move;
            
            this.grid.flat().forEach(t => t.enPassant = false);

            if (piece instanceof Pawn && Math.abs(startRow - endRow) === 2) {
                const enPassantRow = (startRow + endRow) / 2;
                this.getTile(enPassantRow, startCol).enPassant = true;
            }

            return {
                ...move,
                capturedPiece,
                wasFirstMove,
                lastEnPassant,
                enPassantCapture,
                castlingRookMove
            };
        }

        unmakeMove(move) {
            const { startRow, startCol, endRow, endCol, capturedPiece, wasFirstMove, lastEnPassant, enPassantCapture, castlingRookMove } = move;
            const startTile = this.getTile(startRow, startCol);
            const endTile = this.getTile(endRow, endCol);
            const piece = endTile.piece;

            startTile.piece = piece;
            endTile.piece = capturedPiece;
            piece.tile = startTile;
            piece.firstMove = wasFirstMove;

            if (enPassantCapture) {
                const capturedPawnTile = this.getTile(startRow, endCol);
                capturedPawnTile.piece = enPassantCapture;
            }

            if (castlingRookMove) {
                this.unmakeMove(castlingRookMove);
            }

            this.grid.flat().forEach(t => t.enPassant = false);
            if (lastEnPassant) {
                const enPassantTile = this.grid.flat().find(t => t.enPassant);
                if(enPassantTile) enPassantTile.enPassant = true;
            }
        }

        isCheck(kingRow, kingCol, kingColor) {
            const opponentColor = kingColor === 'white' ? 'black' : 'white';
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = this.grid[i][j].piece;
                    if (piece && piece.color === opponentColor) {
                        const moves = piece.getAttackMoves(this);
                        if (moves.some(move => move[0] === kingRow && move[1] === kingCol)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        isCheckmate(kingColor) {
            const king = this.getKing(kingColor);
            if (!this.isCheck(king.tile.row, king.tile.col, kingColor)) {
                return false;
            }

            const allMoves = ai.getAllMoves(this, kingColor);
            return allMoves.length === 0;
        }

        isStalemate(kingColor) {
            const king = this.getKing(kingColor);
            if (this.isCheck(king.tile.row, king.tile.col, kingColor)) {
                return false;
            }
            const allMoves = ai.getAllMoves(this, kingColor);
            return allMoves.length === 0;
        }
    }

    class Piece {
        constructor(color, tile) {
            this.color = color;
            this.tile = tile;
            this.firstMove = true;
        }

        getImageName() {
            return `${this.constructor.name.toLowerCase()}-${this.color.charAt(0)}`;
        }

        getValidMoves(board) {
            return [];
        }

        getAttackMoves(board) {
            return this.getValidMoves(board);
        }
    }

    // --- Figuren (Pawn, Rook, Knight, Bishop, Queen, King) bleiben wie in deinem Code ---

    class AI {
        constructor() {
            this.pieceValues = {
                'pawn': 10,
                'knight': 30,
                'bishop': 30,
                'rook': 50,
                'queen': 90,
                'king': 900
            };
        }

        evaluateBoard(board) {
            let score = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board.getTile(i, j).piece;
                    if (piece) {
                        const pieceType = piece.constructor.name.toLowerCase();
                        const value = this.pieceValues[pieceType] || 0;
                        score += piece.color === 'white' ? value : -value;
                    }
                }
            }
            return score;
        }

        minimax(board, depth, alpha, beta, maximizingPlayer) {
            if (depth === 0) {
                return this.evaluateBoard(board);
            }

            const color = maximizingPlayer ? 'white' : 'black';
            const allMoves = this.getAllMoves(board, color);

            if (allMoves.length === 0) {
                const king = board.getKing(color);
                if (board.isCheck(king.tile.row, king.tile.col, color)) {
                    return maximizingPlayer ? -Infinity : Infinity;
                } else {
                    return 0;
                }
            }

            if (maximizingPlayer) {
                let maxEval = -Infinity;
                for (const move of allMoves) {
                    const moveData = board.movePiece(move);
                    const evaluation = this.minimax(board, depth - 1, alpha, beta, false);
                    board.unmakeMove(moveData);
                    maxEval = Math.max(maxEval, evaluation);
                    alpha = Math.max(alpha, evaluation);
                    if (beta <= alpha) break;
                }
                return maxEval;
            } else {
                let minEval = Infinity;
                for (const move of allMoves) {
                    const moveData = board.movePiece(move);
                    const evaluation = this.minimax(board, depth - 1, alpha, beta, true);
                    board.unmakeMove(moveData);
                    minEval = Math.min(minEval, evaluation);
                    beta = Math.min(beta, evaluation);
                    if (beta <= alpha) break;
                }
                return minEval;
            }
        }

        getBestMove(board) {
            console.log('AI is thinking...');
            let bestMove = null;
            let bestValue = Infinity;
            const allMoves = this.getAllMoves(board, 'black');

            for (const move of allMoves) {
                const moveData = board.movePiece(move);
                const boardValue = this.minimax(board, 3, -Infinity, Infinity, true);
                board.unmakeMove(moveData);
                if (boardValue < bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            }
            return bestMove;
        }

        getAllMoves(board, color) {
            const allMoves = [];
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board.getTile(i, j).piece;
                    if (piece && piece.color === color) {
                        const moves = piece.getValidMoves(board);
                        for (const move of moves) {
                            const moveData = board.movePiece({piece, startRow: i, startCol: j, endRow: move[0], endCol: move[1]});
                            const king = board.getKing(color);
                            const stillInCheck = board.isCheck(king.tile.row, king.tile.col, color);
                            board.unmakeMove(moveData);
                            if (!stillInCheck) {
                                allMoves.push({piece, startRow: i, startCol: j, endRow: move[0], endCol: move[1]});
                            }
                        }
                    }
                }
            }
            return allMoves;
        }

        makeMove(board) {
            gameStatus.textContent = 'AI is thinking...';
            setTimeout(() => {
                const bestMove = this.getBestMove(board);
                if (bestMove) {
                    board.movePiece(bestMove);
                    drawPieces();
                    switchPlayer();
                    updateGameState();
                }
            }, 50);
        }
    }

    // Restlicher Code: Board-Rendering, Klicklogik, UI, Reset-Button etc. bleibt gleich wie bei dir.
    // ...
});
