// External dependencies
const fs = require("fs")
const path = require("path")
const express = require("express")
const { createWebhooksApi } = require("@octokit/webhooks")
const { createAppAuth } = require("@octokit/auth-app")
const { graphql } = require("@octokit/graphql")

// Local dependencies
const smeeClient = require(path.join(__dirname, "smee.js"))
// const emojify = require(path.join(__dirname, "emojify.js"))
// const hasCommand = require(path.join(__dirname, "command.js"))
// const updateBodyMutationFor = require(path.join(__dirname, "mutations.js"))

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

webhooks.on(["pull_request.opened", "pull_request.unassigned", "pull_request.assigned", "pull_request.closed"], async (event) => {
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

  const pullRequest = payload.pull_request
  const body = (pullRequest).body
  const merged = (pullRequest).merged
  const nodeId = (pullRequest).node_id

  merged ? console.log("Pull request already merged") : console.log("Pull request not merged")
  console.log(`This is the body: ${body}`)

  // if (hasCommand("emojify", body)) {
  //   const newBody = emojify(body)
  //   try {
  //     await graphqlWithAuth(updateBodyMutationFor(event.name), {
  //       newBody: newBody,
  //       id: nodeId
  //     })
  //     return
  //   } catch (error) {
  //     console.error(error)
  //   }
  // }

  try {
    const testQuery = await graphqlWithAuth({
      query: `query {
        node(id:"${nodeId}") {
          ... on PullRequest{
            title
            author{
                login
            }
            baseRef{
                name
            }
            labels(last: 10){
                nodes{
                    name
                }
            }
            updatedAt
            createdAt
            mergedAt
            number
            reviews(last:10){
                nodes{
                author{
                    login
                }
                state
                }
            }
            reviewDecision
            latestReviews(last: 10) {
                nodes {
                author {
                    login
                }
                state
                }
            }
          }
        }
      }`
    })
    console.log(testQuery)
  } catch (err) {
    console.log(err)
  }
})

webhooks.on("error", (error) => {
  console.log(`Error: ${error.stack}`)
})

const listener = app.listen(port, () => {
  console.log("Your app is listening on port " + listener.address().port)
})
