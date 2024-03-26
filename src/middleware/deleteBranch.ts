import { Request, Response, NextFunction } from "express"
import { getAuthenticatedOctaKitClient } from "../auth";
export const deleteBranchRef = async (req: Request, res: Response, next: NextFunction, token: string) => {
  const octakit = await getAuthenticatedOctaKitClient(token);
  if (req.body.action === 'closed' && req.headers['x-github-event'] === 'pull_request') {
    const {repository, pull_request} = req.body;
    const ref = pull_request.head.ref;
    console.log(`Deleting branch ${ref}`);
    const addComment = await octakit.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `Auto-Deleting branch ${ref}`
    })
    const deleteBranch = await octakit.git.deleteRef({
      owner: repository.owner.login,
      repo: repository.name,
      ref: `heads/${ref}`
    })
  }
  next();
}