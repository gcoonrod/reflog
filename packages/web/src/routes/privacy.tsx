import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Anchor, Box } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import privacyContent from "@/content/privacy.md?raw";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Container size="sm" py="xl">
      <Anchor component={Link} to="/" size="sm" mb="md" display="block">
        &larr; Back to Reflog
      </Anchor>
      <Box className="markdown-content">
        <ReactMarkdown>{privacyContent}</ReactMarkdown>
      </Box>
    </Container>
  );
}
