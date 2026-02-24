import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  clearAuthStorage,
  getDisplayCreatedAt,
  getDisplayEmail,
  getDisplayName,
  getDisplayRole,
  getInitials,
  readStoredUser,
  writeStoredUser,
  type StoredUser,
} from "../lib/userStorage";
import {
  changePassword,
  getCurrentUser,
  updateUserProfile,
} from "../lib/api";

export function ProfilePage() {
  const navigate = useNavigate();
  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => readStoredUser());
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState(() => getDisplayName(readStoredUser()));
  const [formEmail, setFormEmail] = useState(() => getDisplayEmail(readStoredUser()));
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  useEffect(() => {
    let isActive = true;

    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!isActive) return;
        const safeUser = user as StoredUser;
        setStoredUser(safeUser);
        writeStoredUser(safeUser);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load profile.";
        toast.error(message);
      }
    };

    loadUser();

    return () => {
      isActive = false;
    };
  }, []);

  const storedName = getDisplayName(storedUser);
  const storedEmail = getDisplayEmail(storedUser);
  const displayName = isEditing ? (formName.trim() || storedName) : storedName;
  const displayEmail = isEditing ? (formEmail.trim() || storedEmail) : storedEmail;
  const role = getDisplayRole(storedUser);
  const createdAt = getDisplayCreatedAt(storedUser);
  const initials = getInitials(displayName, displayEmail);

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login", { replace: true });
  };

  const startEdit = () => {
    setFormName(storedName);
    setFormEmail(storedEmail);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormName(storedName);
    setFormEmail(storedEmail);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (storedUser?.id == null) {
      toast.error("User record not available yet.");
      return;
    }

    const nextName = formName.trim() || storedName;
    const nextEmail = formEmail.trim() || storedEmail;

    try {
      const updatedUser = await updateUserProfile(storedUser.id, {
        full_name: nextName,
        email: nextEmail,
      });

      setStoredUser(updatedUser);
      writeStoredUser(updatedUser);
      setFormName(getDisplayName(updatedUser));
      setFormEmail(getDisplayEmail(updatedUser));
      setIsEditing(false);
      toast.success("Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      toast.error(message);
    }
  };

  const currentPasswordError =
    passwordTouched.current && currentPassword.trim() === ""
      ? "Current password is required."
      : "";
  const newPasswordError =
    passwordTouched.next && newPassword.length < 8
      ? "New password must be at least 8 characters."
      : "";
  const confirmPasswordError =
    passwordTouched.confirm && confirmPassword.length === 0
      ? "Please confirm your new password."
      : passwordTouched.confirm && confirmPassword !== newPassword
        ? "Passwords do not match."
        : "";

  const canUpdatePassword =
    currentPassword.trim().length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword;

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordTouched({ current: false, next: false, confirm: false });
  };

  const handlePasswordSubmit = async () => {
    setPasswordTouched({ current: true, next: true, confirm: true });
    if (!canUpdatePassword) return;

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password updated.");
      resetPasswordForm();
      setPasswordOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password.";
      const normalized = message.toLowerCase();
      if (normalized.includes("404") || normalized.includes("not found")) {
        toast.warning("Password change requires backend endpoint (not implemented).");
        resetPasswordForm();
        setPasswordOpen(false);
        return;
      }
      toast.error(message);
    }
  };

  const handlePasswordOpenChange = (open: boolean) => {
    setPasswordOpen(open);
    if (!open) resetPasswordForm();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] text-[#111827]">Profile</h2>
        <p className="text-[16px] text-[#374151]">View and manage your account</p>
      </div>

      <div className="max-w-4xl w-full mx-auto">
        <Card className="p-6 rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-20 h-20 bg-[#15803D] rounded-full flex items-center justify-center text-white text-2xl">
              {initials}
            </div>
            {isEditing ? (
              <div className="w-full max-w-sm space-y-3">
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-xl text-center bg-white"
                  aria-label="Full name"
                />
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="rounded-xl text-center bg-white"
                  aria-label="Email"
                />
              </div>
            ) : (
              <div>
                <p className="text-[22px] text-[#111827]">{displayName}</p>
                <p className="text-[14px] text-[#6B7280]">{displayEmail}</p>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-[12px] text-[#6B7280]">Username</p>
              <p className="text-[14px] text-[#111827]">
                {storedUser?.username ?? "-"}
              </p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-[12px] text-[#6B7280]">Role</p>
              <p className="text-[14px] text-[#111827]">{role}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-[12px] text-[#6B7280]">Email</p>
              <p className="text-[14px] text-[#111827]">{displayEmail}</p>
            </div>
            {createdAt && (
              <div className="rounded-xl bg-[#F9FAFB] p-4">
                <p className="text-[12px] text-[#6B7280]">Created At</p>
                <p className="text-[14px] text-[#111827]">{createdAt}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isEditing ? (
              <>
                <Button
                  className="bg-[#15803D] hover:bg-[#16A34A] text-white rounded-xl"
                  onClick={handleSaveEdit}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" className="rounded-xl" onClick={startEdit}>
                Edit Profile
              </Button>
            )}

            <Dialog open={passwordOpen} onOpenChange={handlePasswordOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Update your password securely for this account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      onBlur={() =>
                        setPasswordTouched((prev) => ({ ...prev, current: true }))
                      }
                      className="rounded-xl"
                    />
                    {currentPasswordError && (
                      <p className="text-xs text-[#DC2626]">{currentPasswordError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onBlur={() =>
                        setPasswordTouched((prev) => ({ ...prev, next: true }))
                      }
                      className="rounded-xl"
                    />
                    {newPasswordError && (
                      <p className="text-xs text-[#DC2626]">{newPasswordError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() =>
                        setPasswordTouched((prev) => ({ ...prev, confirm: true }))
                      }
                      className="rounded-xl"
                    />
                    {confirmPasswordError && (
                      <p className="text-xs text-[#DC2626]">{confirmPasswordError}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handlePasswordOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#15803D] hover:bg-[#16A34A] text-white rounded-xl"
                    onClick={handlePasswordSubmit}
                    disabled={!canUpdatePassword}
                  >
                    Update Password
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>

        <Button
          className="mt-6 w-full bg-[#15803D] hover:bg-[#16A34A] text-white rounded-xl"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
