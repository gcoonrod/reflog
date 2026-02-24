import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Anchor, Box } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import termsContent from "@/content/terms.md?raw";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <Container size="sm" py="xl">
      <Anchor component={Link} to="/" size="sm" mb="md" display="block">
        &larr; Back to Reflog
      </Anchor>
      <Box className="markdown-content">
        <ReactMarkdown>{termsContent}</ReactMarkdown>
      </Box>
    </Container>
  );
}
