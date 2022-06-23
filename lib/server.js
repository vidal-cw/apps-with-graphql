// External dependencies
const fs = require("fs")
const path = require("path")
const express = require("express")
const { createWebhooksApi } = require("@octokit/webhooks")
const { createAppAuth } = require("@octokit/auth-app")
const { graphql } = require("@octokit/graphql")

// Local dependencies
const smeeClient = require(path.join(__dirname, "smee.js"))
const emojify = require(path.join(__dirname, "emojify.js"))
const hasCommand = require(path.join(__dirname, "command.js"))
const updateBodyMutationFor = require(path.join(__dirname, "mutations.js"))

// Setup
const port = 64897
const app = express()
const config = JSON.parse(fs.readFileSync("config.json", "utf8"))
const privateKey = fs.readFileSync("gh-app.pem", "utf8")

const smee = smeeClient(config.webproxy_url, port)
smee.start()

// App
const webhooks = new createWebhooksApi({ secret: config.webhook_secret, path: "/webhooks" })
app.use(webhooks.middleware)

webhooks.on(["issue_comment.created", "issues.opened", "pull_request.opened"], async (event) => {
  const { payload } = event

  const auth = await createAppAuth({
    id: config.github_app_id,
    privateKey: privateKey,
    installationId: payload.installation.id
  })

  const graphqlWithAuth = graphql.defaults({
    request: {
      hook: auth.hook
    }
  })

  const { comment, issue, pullRequest } = payload
  const body = (comment || issue || pullRequest).body
  const nodeId = (comment || issue || pullRequest).node_id

  if (hasCommand("emojify", body)) {
    const newBody = emojify(body)
    try {
      await graphqlWithAuth(updateBodyMutationFor(event.name), {
        newBody: newBody,
        id: nodeId
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  // try {
  //   const testQuery = await graphqlWithAuth({
  //     query: "query { viewer { login } }"
  //   })
  //   console.log(testQuery)
  // } catch (err) {
  //   console.log(err)
  // }
})

webhooks.on("error", (error) => {
  console.log(`Error: ${error.stack}`)
})

const listener = app.listen(port, () => {
  console.log("Your app is listening on port " + listener.address().port)
})
