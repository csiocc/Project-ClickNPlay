
document.addEventListener('DOMContentLoaded', () => {

    class Tile {
        constructor(row, col, piece = null) {
            this.row = row;
            this.col = col;
            this.piece = piece;
            this.element = null;
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
                        if (piece instanceof King) {
                            const moves = validMovesCalculator.kingMoves[i][j];
                            if (moves.some(move => move[0] === kingRow && move[1] === kingCol)) {
                                return true;
                            }
                        } else {
                            const moves = piece.getAttackMoves(this);
                            if (moves.some(move => move[0] === kingRow && move[1] === kingCol)) {
                                return true;
                            }
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

            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = this.grid[i][j].piece;
                    if (piece && piece.color === kingColor) {
                        const moves = piece.getValidMoves(this);
                        for (const move of moves) {
                            const moveData = this.movePiece({startRow: i, startCol: j, endRow: move[0], endCol: move[1]});
                            const newKing = this.getKing(kingColor);
                            if (!this.isCheck(newKing.tile.row, newKing.tile.col, kingColor)) {
                                this.unmakeMove(moveData);
                                return false;
                            }
                            this.unmakeMove(moveData);
                        }
                    }
                }
            }
            return true;
        }

        isStalemate(kingColor) {
            const king = this.getKing(kingColor);
            if (this.isCheck(king.tile.row, king.tile.col, kingColor)) {
                return false;
            }

            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = this.grid[i][j].piece;
                    if (piece && piece.color === kingColor) {
                        if (piece.getValidMoves(this).length > 0) {
                            return false;
                        }
                    }
                }
            }
            return true;
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
            // This will be overridden by each piece type
            return [];
        }

        getAttackMoves(board) {
            return this.getValidMoves(board);
        }
    }

    class Pawn extends Piece {
        getValidMoves(board) {
            const moves = [];
            const direction = this.color === 'white' ? -1 : 1;
            
            // Forward move
            const oneStep = [this.tile.row + direction, this.tile.col];
            const oneStepTile = board.getTile(oneStep[0], oneStep[1]);
            if (oneStepTile && !oneStepTile.piece) {
                moves.push(oneStep);
            }

            // Two steps forward
            if (this.firstMove) {
                const twoSteps = [this.tile.row + 2 * direction, this.tile.col];
                const twoStepsTile = board.getTile(twoSteps[0], twoSteps[1]);
                if (twoStepsTile && !twoStepsTile.piece && !oneStepTile.piece) {
                    moves.push(twoSteps);
                }
            }

            // Capture
            const captureMoves = this.getAttackMoves(board);
            captureMoves.forEach(move => {
                const tile = board.getTile(move[0], move[1]);
                if (tile && tile.piece && tile.piece.color !== this.color) {
                    moves.push(move);
                }
            });

            // En Passant
            const enPassantMoves = [
                [this.tile.row, this.tile.col - 1],
                [this.tile.row, this.tile.col + 1]
            ];
            enPassantMoves.forEach(move => {
                const tile = board.getTile(move[0], move[1]);
                if (tile && tile.piece && tile.piece.color !== this.color && board.lastMove && board.lastMove.piece === tile.piece && Math.abs(board.lastMove.startRow - board.lastMove.endRow) === 2) {
                    const enPassantTarget = [this.tile.row + direction, this.tile.col + (move[1] - this.tile.col)];
                    const targetTile = board.getTile(enPassantTarget[0], enPassantTarget[1]);
                    if (targetTile && !targetTile.piece) {
                        moves.push(enPassantTarget);
                        targetTile.enPassant = true;
                    }
                }
            });


            return moves;
        }

        getAttackMoves(board) {
            const moves = [];
            const direction = this.color === 'white' ? -1 : 1;
            const attackMoves = [
                [this.tile.row + direction, this.tile.col - 1],
                [this.tile.row + direction, this.tile.col + 1]
            ];
            attackMoves.forEach(move => {
                if (move[0] >= 0 && move[0] < 8 && move[1] >= 0 && move[1] < 8) {
                    moves.push(move);
                }
            });
            return moves;
        }
    }

    class Rook extends Piece {
        getValidMoves(board) {
            return validMovesCalculator.getSlidingMoves(this.tile.row, this.tile.col, this.color, board, validMovesCalculator.rookMoves[this.tile.row][this.tile.col]);
        }
    }

    class Knight extends Piece {
        getValidMoves(board) {
            return validMovesCalculator.getKnightMoves(this.tile.row, this.tile.col, this.color, board);
        }
    }

    class Bishop extends Piece {
        getValidMoves(board) {
            return validMovesCalculator.getSlidingMoves(this.tile.row, this.tile.col, this.color, board, validMovesCalculator.bishopMoves[this.tile.row][this.tile.col]);
        }
    }

    class Queen extends Piece {
        getValidMoves(board) {
            const rookMoves = validMovesCalculator.getSlidingMoves(this.tile.row, this.tile.col, this.color, board, validMovesCalculator.rookMoves[this.tile.row][this.tile.col]);
            const bishopMoves = validMovesCalculator.getSlidingMoves(this.tile.row, this.tile.col, this.color, board, validMovesCalculator.bishopMoves[this.tile.row][this.tile.col]);
            return rookMoves.concat(bishopMoves);
        }
    }

    class King extends Piece {
        getValidMoves(board) {
            const moves = validMovesCalculator.getKingMoves(this.tile.row, this.tile.col, this.color, board)
                .filter(move => !board.isCheck(move[0], move[1], this.color));

            // Castling
            if (this.firstMove && !board.isCheck(this.tile.row, this.tile.col, this.color)) {
                // Kingside
                const kingsideRook = board.getTile(this.tile.row, 7).piece;
                if (kingsideRook && kingsideRook.firstMove) {
                    if (!board.getTile(this.tile.row, 5).piece && !board.getTile(this.tile.row, 6).piece) {
                        if (!board.isCheck(this.tile.row, 5, this.color) && !board.isCheck(this.tile.row, 6, this.color)) {
                            moves.push([this.tile.row, 6]);
                        }
                    }
                }
                // Queenside
                const queensideRook = board.getTile(this.tile.row, 0).piece;
                if (queensideRook && queensideRook.firstMove) {
                    if (!board.getTile(this.tile.row, 1).piece && !board.getTile(this.tile.row, 2).piece && !board.getTile(this.tile.row, 3).piece) {
                        if (!board.isCheck(this.tile.row, 2, this.color) && !board.isCheck(this.tile.row, 3, this.color)) {
                            moves.push([this.tile.row, 2]);
                        }
                    }
                }
            }
            return moves;
        }

        getAttackMoves(board) {
            return validMovesCalculator.kingMoves[this.tile.row][this.tile.col];
        }
    }

    class ValidMoves {
        constructor() {
            this.precompute();
        }

        precompute() {
            this.knightMoves = Array(8).fill(null).map(() => Array(8).fill(null));
            this.kingMoves = Array(8).fill(null).map(() => Array(8).fill(null));
            this.rookMoves = Array(8).fill(null).map(() => Array(8).fill(null).map(() => ({})));
            this.bishopMoves = Array(8).fill(null).map(() => Array(8).fill(null).map(() => ({})));

            const rookDirections = {up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1]};
            const bishopDirections = {upLeft: [-1, -1], upRight: [-1, 1], downLeft: [1, -1], downRight: [1, 1]};

            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    this.knightMoves[i][j] = this.computeKnightMoves(i, j);
                    this.kingMoves[i][j] = this.computeKingMoves(i, j);
                    this.rookMoves[i][j] = this.computeSlidingMoves(i, j, rookDirections);
                    this.bishopMoves[i][j] = this.computeSlidingMoves(i, j, bishopDirections);
                }
            }
        }

        computeKnightMoves(row, col) {
            const moves = [];
            const potentialMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const move of potentialMoves) {
                const newRow = row + move[0];
                const newCol = col + move[1];
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                    moves.push([newRow, newCol]);
                }
            }
            return moves;
        }

        computeKingMoves(row, col) {
            const moves = [];
            const potentialMoves = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const move of potentialMoves) {
                const newRow = row + move[0];
                const newCol = col + move[1];
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                    moves.push([newRow, newCol]);
                }
            }
            return moves;
        }

        computeSlidingMoves(row, col, directions) {
            const moves = {};
            for (const dirName in directions) {
                const dir = directions[dirName];
                moves[dirName] = [];
                for (let i = 1; i < 8; i++) {
                    const newRow = row + dir[0] * i;
                    const newCol = col + dir[1] * i;
                    if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                        moves[dirName].push([newRow, newCol]);
                    } else {
                        break;
                    }
                }
            }
            return moves;
        }

        getSlidingMoves(row, col, color, board, precomputedMoves) {
            const moves = [];

            for (const dirName in precomputedMoves) {
                const precomputedDirMoves = precomputedMoves[dirName];

                for (const move of precomputedDirMoves) {
                    const tile = board.getTile(move[0], move[1]);
                    if (tile.piece) {
                        if (tile.piece.color !== color) {
                            moves.push(move);
                        }
                        break;
                    }
                    moves.push(move);
                }
            }
            return moves;
        }

        getKnightMoves(row, col, color, board) {
            return this.knightMoves[row][col].filter(move => {
                const tile = board.getTile(move[0], move[1]);
                return !tile.piece || tile.piece.color !== color;
            });
        }

        getKingMoves(row, col, color, board) {
            return this.kingMoves[row][col].filter(move => {
                const tile = board.getTile(move[0], move[1]);
                return !tile.piece || tile.piece.color !== color;
            });
        }
    }

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

            this.pawnTable = [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,  0,  0,  0]
            ];

            this.knightTable = [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ];

            this.bishopTable = [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5, 10, 10,  5,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10, 10, 10, 10, 10, 10, 10,-10],
                [-10,  5,  0,  0,  0,  0,  5,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ];

            this.kingTable = [
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [ 20, 20,  0,  0,  0,  0, 20, 20],
                [ 20, 30, 10,  0,  0, 10, 30, 20]
            ];
        }

        evaluateBoard(board) {
            let score = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board.getTile(i, j).piece;
                    if (piece) {
                        const pieceType = piece.constructor.name.toLowerCase();
                        const value = this.pieceValues[pieceType] + this.getPiecePositionValue(piece, i, j);
                        score += piece.color === 'white' ? value : -value;
                    }
                }
            }
            return score;
        }

        getPiecePositionValue(piece, row, col) {
            const pieceType = piece.constructor.name.toLowerCase();
            if (piece.color === 'black') {
                row = 7 - row;
            }
            switch (pieceType) {
                case 'pawn': return this.pawnTable[row][col];
                case 'knight': return this.knightTable[row][col];
                case 'bishop': return this.bishopTable[row][col];
                case 'king': return this.kingTable[row][col];
                default: return 0;
            }
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
                    if (beta <= alpha) {
                        break;
                    }
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
                    if (beta <= alpha) {
                        break;
                    }
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
                console.log(`Move: ${move.piece.constructor.name} to ${move.endRow},${move.endCol}, value: ${boardValue}`);
                if (boardValue < bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            }
            console.log('Best move found:', bestMove);
            return bestMove;
        }

        getAllMoves(board, color) {
            const allMoves = [];
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board.getTile(i, j).piece;
                    if (piece && piece.color === color) {
                        const moves = piece.getValidMoves(board);
                        if (moves.length > 0) {
                            moves.forEach(move => allMoves.push({piece, startRow: i, startCol: j, endRow: move[0], endCol: move[1]}));
                        }
                    }
                }
            }
            return allMoves;
        }

        makeMove(board) {
            gameStatus.textContent = 'AI is thinking...';
            setTimeout(() => {
                console.log('AI makeMove called');
                const bestMove = this.getBestMove(board);
                if (bestMove) {
                    board.movePiece(bestMove);
                    drawPieces();
                    switchPlayer();
                    updateGameState();
                }
            }, 10);
        }
    }

    const chessboard = document.getElementById('chessboard');
    const turnIndicator = document.getElementById('turn-indicator');
    const gameStatus = document.getElementById('game-status');
    const resetButton = document.getElementById('reset-button');
    const aiButton = document.getElementById('ai-button');

    let board = new Board();
    let selectedPiece = null;
    let currentPlayer = 'white';
    let gameState = 'playing'; // playing, check, checkmate, stalemate
    let aiEnabled = false;
    let ai = new AI();

    const validMovesCalculator = new ValidMoves();

    function createBoard() {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.dataset.row = i;
                square.dataset.col = j;
                if ((i + j) % 2 === 0) {
                    square.classList.add('white');
                } else {
                    square.classList.add('black');
                }
                chessboard.appendChild(square);
                board.grid[i][j].element = square;
                square.addEventListener('click', () => onSquareClick(i, j));
            }
        }
    }

    function onSquareClick(row, col) {
        if (gameState !== 'playing' && gameState !== 'check') return;
        if (aiEnabled && currentPlayer === 'black') return;

        const clickedTile = board.getTile(row, col);
        if (selectedPiece) {
            const validMoves = selectedPiece.getValidMoves(board);
            if (validMoves.some(move => move[0] === row && move[1] === col)) {
                board.movePiece({startRow: selectedPiece.tile.row, startCol: selectedPiece.tile.col, endRow: row, endCol: col});
                drawPieces();
                selectedPiece = null;
                clearHighlights();
                
                const piece = board.getTile(row, col).piece;
                if (piece instanceof Pawn && (row === 0 || row === 7)) {
                    promotePawn(row, col);
                }

                switchPlayer();
                updateGameState();

            } else {
                selectedPiece = null;
                clearHighlights();
            }
        } else if (clickedTile.piece && clickedTile.piece.color === currentPlayer) {
            clearHighlights();
            selectedPiece = clickedTile.piece;
            selectedPiece.tile.element.classList.add('selected');
        }
    }

    function promotePawn(row, col) {
        const piece = board.getTile(row, col).piece;
        // For simplicity, auto-promote to Queen. A proper UI would ask the user.
        board.getTile(row, col).piece = new Queen(piece.color, piece.tile);
        drawPieces();
    }

    function updateGameState() {
        gameStatus.textContent = '';
        const king = board.getKing(currentPlayer);
        if (board.isCheck(king.tile.row, king.tile.col, currentPlayer)) {
            if (board.isCheckmate(currentPlayer)) {
                gameState = 'checkmate';
                gameStatus.textContent = 'Checkmate! ' + (currentPlayer === 'white' ? 'Black' : 'White') + ' wins.';
            } else {
                gameState = 'check';
                gameStatus.textContent = 'Check!';
            }
        } else if (board.isStalemate(currentPlayer)) {
            gameState = 'stalemate';
            gameStatus.textContent = 'Stalemate!';
        } else {
            gameState = 'playing';
        }
        turnIndicator.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;

        if (aiEnabled && currentPlayer === 'black' && gameState === 'playing') {
            ai.makeMove(board);
        }
    }
    
    function switchPlayer() {
        currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    }

    function clearHighlights() {
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    }

    function drawPieces() {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const tile = board.getTile(i, j);
                if (tile.element.firstChild) {
                    tile.element.firstChild.remove();
                }
                if (tile.piece) {
                    const img = document.createElement('img');
                    img.classList.add('piece');
                    img.src = `chess/img/${tile.piece.getImageName()}.svg`;
                    tile.element.appendChild(img);
                }
            }
        }
    }

    function resetGame() {
        location.reload();
    }

    function toggleAI() {
        aiEnabled = !aiEnabled;
        aiButton.textContent = `AI (Black): ${aiEnabled ? 'ON' : 'OFF'}`;
        updateGameState();
    }

    resetButton.addEventListener('click', resetGame);
    aiButton.addEventListener('click', toggleAI);

    createBoard();
    drawPieces();
    updateGameState();
});
