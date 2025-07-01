import { ViewIssueModal } from '@forge/jira-bridge';

export type IssueLinkProps = {
  issueKey: string;
  issueSummary: string;
}

export const IssueLink = (props: IssueLinkProps) => {
  const linkText = `${props.issueKey} ${props.issueSummary}`;
  return (
    <span
      className="button-link"
      onClick={() => {
        const viewIssueModal = new ViewIssueModal({
          onClose: () => {
            // console.log('ViewIssueModal closed');
          },
          context: {
            issueKey: props.issueKey,
          },
        });
        viewIssueModal.open();
      }}
    >
      {linkText}
    </span>
  );
}
