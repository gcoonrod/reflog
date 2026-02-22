import { useState } from "react";
import {
  Menu,
  UnstyledButton,
  Avatar,
  Text,
  Modal,
  Stack,
  Button,
  Group,
  TextInput,
} from "@mantine/core";
import {
  IconLock,
  IconLogout,
  IconDownload,
  IconTrash,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/hooks/useVault";
import { performLogout } from "@/services/auth";
import * as syncApi from "@/services/syncApi";
import { decryptFromSync } from "@/services/syncCrypto";
import { getEncryptionKey } from "@/db";

export function AccountMenu() {
  const { user, getToken, logout } = useAuth();
  const { lock } = useVault();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleLock = () => {
    lock();
  };

  const handleLogout = (clearData: boolean) => {
    setLogoutModalOpen(false);
    void performLogout(clearData).then(() => {
      logout();
    });
  };

  // T050: Account deletion
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const token = await getToken();
      await syncApi.deleteAccount(token);
      await performLogout(true);
      logout();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete account";
      notifications.show({
        title: "Account deletion failed",
        message,
        color: "red",
      });
      setDeleting(false);
    }
  };

  // T051: Data export
  const handleExportData = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const cryptoKey = getEncryptionKey();
      if (!cryptoKey) {
        notifications.show({
          title: "Export failed",
          message: "Vault must be unlocked to export data",
          color: "red",
        });
        setExporting(false);
        return;
      }

      const exportData = await syncApi.exportData(token);
      const decryptedRecords = [];

      for (const record of exportData.records) {
        if (record.isTombstone || !record.encryptedPayload) continue;
        try {
          const decrypted = await decryptFromSync(
            record.encryptedPayload,
            cryptoKey,
          );
          decryptedRecords.push(decrypted);
        } catch {
          // Skip records that can't be decrypted
        }
      }

      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: exportData.exportedAt,
              entries: decryptedRecords,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );

      const date = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reflog-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);

      notifications.show({
        title: "Export complete",
        message: `Exported ${decryptedRecords.length} entries`,
        color: "green",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export data";
      notifications.show({
        title: "Export failed",
        message,
        color: "red",
      });
    } finally {
      setExporting(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <Menu shadow="md" width={220} position="bottom-end">
        <Menu.Target>
          <UnstyledButton>
            <Avatar
              src={user?.picture}
              alt={user?.name ?? "Account"}
              radius="xl"
              size="sm"
            >
              {initials}
            </Avatar>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>
            <Text size="xs" truncate>
              {user?.email ?? ""}
            </Text>
          </Menu.Label>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconDownload size={16} />}
            onClick={() => void handleExportData()}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export Data"}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconLock size={16} />}
            onClick={handleLock}
          >
            Lock
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconLogout size={16} />}
            onClick={() => { setLogoutModalOpen(true); }}
          >
            Log out
          </Menu.Item>

          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => { setDeleteModalOpen(true); }}
          >
            Delete Account
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={logoutModalOpen}
        onClose={() => { setLogoutModalOpen(false); }}
        title="Log out"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">
            Would you like to keep your local data on this device or clear it?
          </Text>
          <Group grow>
            <Button variant="light" onClick={() => { handleLogout(false); }}>
              Keep local data
            </Button>
            <Button
              color="red"
              variant="light"
              onClick={() => { handleLogout(true); }}
            >
              Clear local data
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmEmail("");
        }}
        title="Delete Account"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">
            This will permanently delete your account and all synced data. Local
            data on all devices will be removed. This action cannot be undone.
          </Text>
          <TextInput
            label={`Type "${user?.email ?? ""}" to confirm`}
            value={deleteConfirmEmail}
            onChange={(e) => { setDeleteConfirmEmail(e.currentTarget.value); }}
            placeholder="Enter your email"
          />
          <Button
            color="red"
            disabled={deleteConfirmEmail !== (user?.email ?? "")}
            loading={deleting}
            onClick={() => void handleDeleteAccount()}
          >
            Permanently Delete Account
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
