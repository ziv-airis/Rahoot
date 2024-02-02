import { GAME_STATE_INIT } from "../quizz.config.js"
import { startRound } from "../utils/round.js"
import generateRoomId from "../utils/generateRoomId.js"
import { cooldown, sleep } from "../utils/cooldown.js"

const Manager = {
  createRoom: (game, io, socket) => {
    if (game.manager || game.room) {
      io.to(socket.id).emit("message", "Already manager")
      return
    }

    let roomInvite = generateRoomId()
    game.room = roomInvite
    game.manager = socket.id

    socket.join(roomInvite)
    io.to(socket.id).emit("manager:inviteCode", roomInvite)

    console.log("New room created: " + roomInvite)
  },

  kickPlayer: (game, io, socket, playerId) => {
    if (game.manager !== socket.id) {
      return
    }

    const player = game.players.find((p) => p.id === playerId)
    game.players = game.players.filter((p) => p.id !== playerId)

    io.to(player.id).emit("game:kick")
    io.to(game.manager).emit("manager:playerKicked", player.id)
  },

  startGame: async (game, io, socket) => {
    if (game.started || !game.room) {
      return
    }

    game.started = true
    io.to(game.room).emit("game:status", {
      name: "SHOW_START",
      data: {
        time: 3,
        subject: "Adobe",
      },
    })

    await sleep(3)
    io.to(game.room).emit("game:startCooldown")

    await cooldown(3, io, game.room)
    startRound(game, io, socket)
  },

  nextQuestion: (game, io, socket) => {
    if (!game.started) {
      return
    }

    if (socket.id !== game.manager) {
      return
    }

    if (!game.questions[game.currentQuestion + 1]) {
      return
    }

    game.currentQuestion++
    startRound(game, io, socket)
  },

  showLoaderboard: (game, io, socket) => {
    if (!game.questions[game.currentQuestion + 1]) {
      io.to(socket).emit("game:status", {
        name: "FINISH",
        data: {
          winners: game.players.slice(0, 3).sort((a, b) => b.points - a.points),
        },
      })

      game = GAME_STATE_INIT
      return
    }

    io.to(socket.id).emit("game:status", {
      name: "SHOW_LEADERBOARD",
      data: {
        leaderboard: game.players
          .sort((a, b) => b.points - a.points)
          .slice(0, 5),
      },
    })
  },
}

export default Manager
