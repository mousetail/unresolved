import {useEffect, useState} from "react";
import unresolvedCommentsQuery from '../queries/get-comments-query.graphql'
import {createRoot} from "react-dom/client";
import lodash from "lodash"

function useLocalStorage(storageKey: string, defaultValue: string): [string, (string) => void] {
    const [value, setValue] = useState(localStorage.getItem(storageKey) ?? defaultValue)
    const setValueInStorage = (value) => {
        localStorage.setItem(storageKey, value)
        setValue(value)
    }
    return [value, setValueInStorage]
}

function Main() {
    const [authorizationToken, setAuthorizationToken] = useLocalStorage('apiKey', '')
    const [repository, setRepository] = useLocalStorage('repository', '')
    const [author, setAuthor] = useLocalStorage('author', '')
    const [pullRequests, setPullRequests] = useState([])
    const [pullRequestState, setPullRequestState ] = useLocalStorage("pullRequestState", "MERGED")

    useEffect(lodash.debounce(() => {
        fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `bearer ${authorizationToken}`,
            },
            body: JSON.stringify({
                query: unresolvedCommentsQuery,
                variables: {
                    owner: author,
                    repository: repository,
                    state: pullRequestState
                }
            })
        }).then(
            r => r.json()
        ).then(
            data => {
                const pullRequests = data.data.repository.pullRequests.edges.map(
                    pullRequest => ({
                        node: {
                            ...pullRequest.node,
                            reviewThreads: {
                                edges: pullRequest.node.reviewThreads.edges.filter(
                                    reviewThread => reviewThread.node.isResolved === false
                                )
                            }
                        }
                    })
                ).filter(
                    pullRequests => pullRequests.node.reviewThreads.edges.length >= 1
                );
                pullRequests.reverse();
                localStorage.setItem('cachedData', JSON.stringify(pullRequests));
                setPullRequests(pullRequests);
            }
        )
    }, 300), [authorizationToken, pullRequestState, repository, author])

    return <div>
        <h1>Unresolved Comments Checker</h1>

        <label>
            API Key:
            <input value={authorizationToken} onChange={(ev) => setAuthorizationToken(ev.target.value)}
                   type={"password"}/>
        </label>

        <label>
            Repository Author:
            <input value={author} onChange={(ev) => setAuthor(ev.target.value)}/>
        </label>

        <label>
            Repository Name:
            <input value={repository} onChange={(ev) => setRepository(ev.target.value)}/>
        </label>

        <label>
            Pull Request State
            <select value={pullRequestState} onChange={(ev)=>setPullRequestState(ev.target.value)}>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="MERGED">Merged</option>
            </select>
        </label>

        {
            pullRequests.filter(
                pr => pr.node.reviewThreads.edges.length >= 1
            ).map(
                (pr) => {
                    return <div className={"pull-request"}>
                            <div className={"pull-request-heading"}>
                                <img src={pr.node.author.avatarUrl}/>
                                <div>
                                    <h2>{pr.node.title}</h2>
                                    <div>Opened by {pr.node.author.login} at {new Date(pr.node.createdAt).toDateString()}</div>
                                </div>
                            </div>
                        {
                            pr.node.reviewThreads.edges.map(thread => {
                                const comment = thread.node.comments.nodes[0]
                                return <div className="comment">
                                    <div className={"author"}>
                                        <img src={comment.author.avatarUrl}/>
                                        <b>{comment.author.login}</b>
                                    </div>
                                    <p>
                                        {comment.body}
                                    </p>
                                    <a href={comment.url} target={"_blank"}>Link</a>
                                </div>
                            })
                        }
                        </div>
                }
            )
        }
    </div>
}

const root = createRoot(document.getElementById('app'),)
root.render(<Main/>)
