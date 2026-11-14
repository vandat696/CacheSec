"""Agent's allowlisted T12 tools and current human authority; no deployment methods."""

from app.change_workflow.proposal_service import ProposalService
from app.change_workflow.workflow_repository import WorkflowError
from app.identity.control_authority import ControlCapability as Cap

RUN_CAPABILITIES = frozenset({Cap.WORKFLOW_RUN, Cap.WORKFLOW_READ})


class WorkflowRunAccess:
    def __init__(self, proposals: ProposalService):
        self.proposals = proposals

    def current(self, token, *, execute):
        capabilities = {Cap.WORKFLOW_READ}
        if execute:
            capabilities.update({Cap.WORKFLOW_RUN, Cap.PROPOSAL_CREATE, Cap.TEST_RUN})
        with self.proposals.transactions.open() as session:
            caller, _ = self.proposals.authorize(session, token, *capabilities)
        return caller


class WorkflowRunTools:
    def __init__(self, proposals: ProposalService):
        self.proposals = proposals

    def check_source(self, token, snapshot_id):
        with self.proposals.transactions.open() as session:
            caller, repository = self.proposals.authorize(
                session, token, *RUN_CAPABILITIES, Cap.PROPOSAL_CREATE, Cap.TEST_RUN
            )
            bundle = self.proposals.snapshots.read_in_transaction(
                session.snapshot, caller.scope, snapshot_id, repository.identity
            )
            if not self.proposals.snapshots.matches_working_tree(bundle):
                raise WorkflowError("STALE_SNAPSHOT")

    def save(self, token, snapshot_id, content, key, previous):
        return self.proposals.save(
            token,
            snapshot_id if previous is None else None,
            content,
            key,
            previous["proposal_id"] if previous else None,
            previous["revision"] if previous else 0,
            required_capabilities=RUN_CAPABILITIES,
        )

    def request_test(self, token, revision, key):
        return self.proposals.request_test(
            token,
            revision["proposal_id"],
            revision["revision"],
            key,
            required_capabilities=RUN_CAPABILITIES,
        )

    def job(self, token, job_id):
        return self.proposals.job(token, job_id)

    def revision(self, token, proposal_id):
        return self.proposals.get(token, proposal_id)
