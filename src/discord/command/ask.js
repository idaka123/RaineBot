const axios = require("axios");
const { sliceString } = require("../format/length");
const dependencies = require("../../config/dependencies")

const getLatestMsg = async (message, id) => {

	const messages = await message.channel.messages.fetch({ limit: 100 });
	const userMessages = messages.filter(m => m.author.id === id); 
	const secondLatestMessage = Array.from(userMessages.values())[1]; // get the second latest message

	if (secondLatestMessage) {
		console.log(`Second latest message from ${message.author.username}: ${secondLatestMessage.content}`);
		return secondLatestMessage
	} else {
		console.log('Not any recent message from this user: ', message.author.username);
		return null
	}
}

const reactIconList = [
	{
		name: "create_reminder",
		icon: "⏱️"
	},
	{
		name: "get_current_weather",
		icon: "☁️"
	},
]

module.exports = {
	data: {
		name: 'raine',
		check: (interaction) => {
			let substringToCheck = "hey raine";
			let botName = "raine"
			console.log(process.env.RAINE_ID)
			if(interaction.mentions?.users?.first()?.id === process.env.RAINE_ID
			|| interaction.content.toLowerCase().includes(substringToCheck.toLowerCase())
			|| interaction.content.toLowerCase().includes(botName.toLowerCase())) return true 

			return false
		}
	},
	async execute(interaction, user) {
		try {
			const { redisClient } = dependencies
			const maxToken = 2000 
			let substringToCheck = "hey raine"; 
			let botName = "raine"
			let prompt = ""
			let files = []
			interaction.channel.sendTyping(10)


			// Change mention to username name if mentiond user is not raine
			if(interaction.mentions?.users?.first() && interaction.mentions?.users?.first()?.id !== process.env.RAINE_ID) {
				interaction.content = interaction.content.replace(`<@${interaction.mentions?.users?.first()?.id}>`, interaction.mentions?.users?.first()?.username)
			}

			// Check and response for the latest missing msg from user
			if(
				(
					interaction.content.toLowerCase() === botName.toLowerCase() || 
					interaction.content.toLowerCase() === substringToCheck.toLowerCase() ||
					interaction.mentions?.users?.first()?.id === process.env.RAINE_ID

				) &&
				interaction.attachments.size === 0
			) {
				interaction = await getLatestMsg(interaction, user.id)
				prompt = interaction.content
			}
			else {
				prompt = interaction.content
			}

			if(interaction.attachments.size > 0) {
				// user attached files		
				for (const [key, value] of interaction.attachments) {
					files.push(value)
				}
			}
			else {
				console.log(0);
			}

			await interaction.react("🔍").then(reaction => {
				const originURL = process.env.ORIGIN_URL || `http://localhost:${process.env.SERVER_PORT}`
				axios.post(`${originURL}/api/v1/openai/ask`, {
					data: {
						content: prompt,
						prepareKey: interaction.channelId,
						files: files
					},
					maxToken: maxToken,
					currentUser: user,
					type: "discord"
				})
				.then(res => {

					if(res.data.func && res.data.func.length > 0) {
						reaction.remove().catch(error => console.error('Failed to remove reactions: ', error));
						res.data.func.map(func => {
							const icon = reactIconList.find(item => item.name === func).icon
							console.log(icon);
							icon && interaction.react(icon)
						})
					}

					if(Array.isArray(res.data.data)) {
						res.data.data.map(msg => {
							interaction.reply(msg)
						})
					} else {
						const newData = sliceString(res.data.data, maxToken)
						newData.map(msg => {
							interaction.reply(msg)
						})
					}
				})
				.catch(async err => {
					reaction.remove().catch(error => console.error('Failed to remove reactions: ', error));
					await interaction.react("☠️")
					interaction.reply("Error Occur", err)
				})

			})

		
		} catch (error) {
			console.log(error)
		}
	},
};
