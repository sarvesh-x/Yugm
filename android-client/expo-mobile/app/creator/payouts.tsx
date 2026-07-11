import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownToLine, ArrowLeft, BadgeIndianRupee, CheckCircle2, Clock3, Coins, FileCheck2, Landmark, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { creatorApi, type CreatorPayoutKyc, type CreatorWithdrawal } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

const editableKycStatuses = new Set(["NOT_SUBMITTED", "REJECTED", "NEEDS_RETRY", "EXPIRED"]);

export default function CreatorPayoutsScreen() {
  const client = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const isCreator = role === "HOST" || role === "MODERATOR" || role === "ADMIN";
  const [legalFullName, setLegalFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [amount, setAmount] = useState("");
  const prefilledKycId = useRef<string>();

  const eligibility = useQuery({
    queryKey: ["creator", "eligibility"],
    queryFn: creatorApi.eligibility,
    enabled: isCreator,
    staleTime: 15_000
  });
  const history = useQuery({
    queryKey: ["creator", "withdrawals"],
    queryFn: creatorApi.withdrawals,
    enabled: isCreator,
    staleTime: 15_000
  });

  const refresh = () => {
    client.invalidateQueries({ queryKey: ["creator"] });
  };

  const submitKyc = useMutation({
    mutationFn: creatorApi.submitPayoutKyc,
    onSuccess: () => {
      setPanNumber("");
      setUpiId("");
      setBankAccount("");
      setAccepted(false);
      refresh();
      Alert.alert("Submitted", "Your payout details are now with the finance review team.");
    },
    onError: (error: Error) => Alert.alert("Could not submit", error.message)
  });

  const withdraw = useMutation({
    mutationFn: creatorApi.requestWithdrawal,
    onSuccess: (data) => {
      setAmount("");
      refresh();
      Alert.alert("Withdrawal requested", data.message || "Your request was sent to finance review.");
    },
    onError: (error: Error) => Alert.alert("Withdrawal unavailable", error.message)
  });

  const kyc = eligibility.data?.payoutKyc;
  const balance = eligibility.data?.balance ?? history.data?.balance;
  const requirements = eligibility.data?.requirements;
  const withdrawals = history.data?.withdrawals ?? [];
  const activeWithdrawal = withdrawals.find((item: CreatorWithdrawal) => item.status === "PENDING_REVIEW" || item.status === "APPROVED");
  const readinessCount = requirements ? [requirements.creatorAccount, requirements.trustVerified && requirements.creatorTrustEnabled, requirements.payoutKycVerified, requirements.payoutEnabled].filter(Boolean).length : 0;
  const amountCoins = Number(amount || 0);
  const estimatedInr = amountCoins * (eligibility.data?.coinToInrRate ?? 0.01);
  const payoutReady = kyc?.kycStatus === "VERIFIED" && kyc.payoutStatus === "ENABLED";
  const panValid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim());
  const upiValid = /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(upiId.trim());
  const bankValid = /^\d{6,40}$/.test(bankAccount.trim()) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.trim()) && bankHolderName.trim().length >= 2;
  const dateValid = !dateOfBirth.trim() || isAdultDateOfBirth(dateOfBirth.trim());
  const canSubmitKyc = legalFullName.trim().length >= 2
    && panValid
    && dateValid
    && (upiValid || bankValid)
    && accepted
    && !submitKyc.isPending;
  const canWithdraw = payoutReady
    && !activeWithdrawal
    && Number.isInteger(amountCoins)
    && amountCoins > 0
    && amountCoins <= (balance?.availableCoins ?? 0)
    && !withdraw.isPending;
  const refreshing = eligibility.isFetching || history.isFetching;

  useEffect(() => {
    if (!kyc || !editableKycStatuses.has(kyc.kycStatus)) return;
    const key = kyc.id ?? kyc.kycStatus;
    if (prefilledKycId.current === key) return;
    prefilledKycId.current = key;
    setLegalFullName(kyc.legalFullName ?? "");
    setDateOfBirth(kyc.dateOfBirth ? String(kyc.dateOfBirth).slice(0, 10) : "");
    setBankIfsc(kyc.bankIfsc ?? "");
    setBankHolderName(kyc.bankHolderName ?? "");
  }, [kyc]);

  if (!isCreator) {
    return (
      <Screen>
        <Header />
        <Section>
          <GlassCard style={styles.emptyCard}>
            <LockKeyhole color={colors.gold} size={32} />
            <Text style={styles.title}>Creator payouts</Text>
            <Text style={styles.muted}>Payout verification appears after your account is enabled as a host or creator. It is never required for regular Yugm use.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryText}>Go back</Text></Pressable>
          </GlassCard>
        </Section>
      </Screen>
    );
  }

  if (eligibility.isLoading || history.isLoading) {
    return <Screen><Header /><View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /><Text style={styles.muted}>Loading creator earnings…</Text></View></Screen>;
  }

  const loadError = eligibility.error || history.error;

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />} keyboardShouldPersistTaps="handled">
          <Section>
            <LinearGradient colors={["#5B2A13", "#2A183F", "#11162A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroHeading}><View style={styles.heroIcon}><BadgeIndianRupee color={colors.gold} size={24} /></View><Text style={styles.heroEyebrow}>Creator earnings</Text></View>
                <View style={[styles.readinessPill, payoutReady && styles.readinessPillReady]}><Text style={[styles.readinessPillText, payoutReady && styles.readinessPillTextReady]}>{payoutReady ? "Payout ready" : `${readinessCount}/4 ready`}</Text></View>
              </View>
              <Text style={styles.balanceLabel}>Available to withdraw</Text>
              <View style={styles.balanceLine}><Text style={styles.balanceValue}>{(balance?.availableCoins ?? 0).toLocaleString()}</Text><Text style={styles.balanceUnit}> gift coins</Text></View>
              <Text style={styles.balanceEstimate}>Estimated ₹{((balance?.availableCoins ?? 0) * (eligibility.data?.coinToInrRate ?? 0.01)).toFixed(2)} settlement value</Text>
              <View style={styles.metrics}>
                <Metric label="Lifetime earned" value={balance?.earnedCoins ?? 0} />
                <Metric label="In review" value={balance?.lockedCoins ?? 0} />
                <Metric label="Paid out" value={balance?.withdrawnCoins ?? 0} />
              </View>
            </LinearGradient>
            {loadError ? <Text style={styles.error}>{(loadError as Error).message}</Text> : null}
          </Section>

          <Section>
            <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Payout readiness</Text><Text style={styles.sectionCaption}>Complete all four checks before settlement.</Text></View><Text style={styles.readinessCount}>{readinessCount}/4</Text></View>
            <GlassCard style={styles.requirementsCard}>
              <RequirementRow icon={<UserRoundCheck color={colors.cyan} size={18} />} title="Creator account" detail="Hosting access is enabled" complete={Boolean(requirements?.creatorAccount)} first />
              <RequirementRow icon={<ShieldCheck color={colors.purple} size={18} />} title="Trust Verification" detail={requirements?.trustVerified && requirements?.creatorTrustEnabled ? "Identity and creator trust approved" : "Complete Yugm Trust Verification"} complete={Boolean(requirements?.trustVerified && requirements?.creatorTrustEnabled)} />
              <RequirementRow icon={<FileCheck2 color={colors.gold} size={18} />} title="Payout KYC" detail={kyc?.submittedAt ? `Submitted ${new Date(kyc.submittedAt).toLocaleDateString()}` : "PAN and payout details required"} complete={Boolean(requirements?.payoutKycVerified)} />
              <RequirementRow icon={<Landmark color={colors.success} size={18} />} title="Finance approval" detail={friendlyStatus(kyc?.payoutStatus)} complete={Boolean(requirements?.payoutEnabled)} last />
            </GlassCard>
          </Section>

          {activeWithdrawal ? (
            <Section>
              <GlassCard style={styles.activeRequest}>
                <View style={styles.activeRequestIcon}><Clock3 color={colors.warning} size={22} /></View>
                <View style={styles.rowGrow}><Text style={styles.activeRequestTitle}>Withdrawal in progress</Text><Text style={styles.muted}>{activeWithdrawal.amountCoins.toLocaleString()} coins · ₹{activeWithdrawal.amountInr.toFixed(2)} · {friendlyStatus(activeWithdrawal.status)}</Text></View>
              </GlassCard>
            </Section>
          ) : null}

          <Section>
            <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Payout profile</Text><Text style={styles.sectionCaption}>Your saved details always remain masked.</Text></View></View>
            <GlassCard>
              <StatusRow label="Identity review" value={friendlyStatus(kyc?.kycStatus)} good={kyc?.kycStatus === "VERIFIED"} />
              <StatusRow label="Payout access" value={friendlyStatus(kyc?.payoutStatus)} good={kyc?.payoutStatus === "ENABLED"} />
              {kyc?.panLast4 ? <MaskedRow label="PAN" value={`••••${kyc.panLast4}`} /> : null}
              {kyc?.upiIdMasked ? <MaskedRow label="UPI" value={kyc.upiIdMasked} /> : null}
              {kyc?.bankAccountLast4 ? <MaskedRow label="Bank" value={`••••${kyc.bankAccountLast4}`} /> : null}
              {kyc?.rejectionReason ? <Text style={styles.error}>{kyc.rejectionReason}</Text> : null}
              {!editableKycStatuses.has(kyc?.kycStatus ?? "NOT_SUBMITTED") ? (
                <Text style={styles.infoText}>{payoutReady ? "Your payout profile is ready." : "Your submission is under review. Pull to refresh for updates."}</Text>
              ) : null}
            </GlassCard>
          </Section>

          {editableKycStatuses.has(kyc?.kycStatus ?? "NOT_SUBMITTED") ? (
            <Section>
              <Text style={styles.sectionTitle}>{kyc?.kycStatus === "NOT_SUBMITTED" ? "Submit payout details" : "Resubmit payout details"}</Text>
              <Text style={styles.sectionCaption}>Keep your legal name exactly as shown on PAN. Choose either UPI or a bank account for settlement.</Text>
              <View style={styles.documentChips}><DetailChip label="PAN" /><DetailChip label="Date of birth" /><DetailChip label="UPI or bank" /></View>
              <GlassCard style={styles.formCard}>
                <Field label="Legal full name" hint="Match the name printed on your PAN" value={legalFullName} onChangeText={setLegalFullName} autoCapitalize="words" />
                <Field label="Date of birth (YYYY-MM-DD)" error={Boolean(dateOfBirth && !dateValid)} hint="Use a valid adult date, for example 1995-08-21" value={dateOfBirth} onChangeText={setDateOfBirth} keyboardType="numbers-and-punctuation" />
                <Field label="PAN" error={Boolean(panNumber && !panValid)} hint="10-character PAN, for example ABCDE1234F" value={panNumber} onChangeText={(value) => setPanNumber(value.toUpperCase().slice(0, 10))} autoCapitalize="characters" secureTextEntry />
                <Text style={styles.formHint}>Choose UPI or bank details for settlement.</Text>
                <Field label="UPI ID" error={Boolean(upiId && !upiValid)} hint="Example: creator@upi" value={upiId} onChangeText={setUpiId} autoCapitalize="none" />
                <Field label="Bank account number" value={bankAccount} onChangeText={(value) => setBankAccount(value.replace(/\D/g, ""))} keyboardType="number-pad" secureTextEntry />
                <Field label="IFSC" error={Boolean(bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc))} hint="11-character branch IFSC" value={bankIfsc} onChangeText={(value) => setBankIfsc(value.toUpperCase().slice(0, 11))} autoCapitalize="characters" />
                <Field label="Bank account holder name" value={bankHolderName} onChangeText={setBankHolderName} autoCapitalize="words" />
                <View style={styles.consentRow}>
                  <Switch value={accepted} onValueChange={setAccepted} trackColor={{ false: colors.line, true: "rgba(50,213,131,0.35)" }} thumbColor={accepted ? colors.success : colors.muted} />
                  <Text style={styles.consentText}>I confirm these payout details belong to me and may be reviewed for creator settlement.</Text>
                </View>
                <Pressable
                  style={[styles.primaryButton, !canSubmitKyc && styles.disabled]}
                  disabled={!canSubmitKyc}
                  onPress={() => submitKyc.mutate({
                    legalFullName: legalFullName.trim(),
                    dateOfBirth: dateOfBirth.trim() || undefined,
                    panNumber: panNumber.trim(),
                    upiId: upiId.trim() || undefined,
                    bankAccount: bankAccount.trim() || undefined,
                    bankIfsc: bankIfsc.trim() || undefined,
                    bankHolderName: bankHolderName.trim() || undefined,
                    declarationsAccepted: accepted
                  })}
                >
                  {submitKyc.isPending ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryText}>Submit for finance review</Text>}
                </Pressable>
                <View style={styles.privacyRow}><ShieldCheck color={colors.success} size={16} /><Text style={styles.privacyText}>PAN and payout identifiers are encrypted; clients receive masked values only.</Text></View>
              </GlassCard>
            </Section>
          ) : null}

          <Section>
            <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Request withdrawal</Text><Text style={styles.sectionCaption}>One active request at a time. Finance reviews every settlement.</Text></View><ArrowDownToLine color={colors.gold} size={21} /></View>
            <GlassCard style={styles.formCard}>
              {!payoutReady ? <Text style={styles.infoText}>Complete Trust Verification and Creator Payout Verification before requesting settlement.</Text> : null}
              {activeWithdrawal ? <Text style={styles.infoText}>Your current withdrawal must finish before you can create another request.</Text> : null}
              <Field label="Gift coins to withdraw" value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ""))} keyboardType="number-pad" />
              {amountCoins > 0 ? <View style={styles.settlementBox}><SettlementRow label="Requested" value={`${amountCoins.toLocaleString()} coins`} /><SettlementRow label="Rate" value={`₹${(eligibility.data?.coinToInrRate ?? 0.01).toFixed(2)} / coin`} /><View style={styles.settlementDivider} /><SettlementRow label="Estimated payout" value={`₹${estimatedInr.toFixed(2)}`} strong /></View> : null}
              {amountCoins > (balance?.availableCoins ?? 0) ? <Text style={styles.error}>Amount exceeds your available gift earnings.</Text> : null}
              <Pressable style={[styles.primaryButton, !canWithdraw && styles.disabled]} disabled={!canWithdraw} onPress={() => withdraw.mutate(amountCoins)}>
                {withdraw.isPending ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryText}>Request withdrawal</Text>}
              </Pressable>
            </GlassCard>
          </Section>

          <Section>
            <Text style={styles.sectionTitle}>Withdrawal history</Text>
            {withdrawals.length ? withdrawals.map((item: CreatorWithdrawal) => <WithdrawalRow key={item.id} item={item} />) : (
              <GlassCard><Text style={styles.muted}>No withdrawal requests yet.</Text></GlassCard>
            )}
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Header() {
  return <View style={styles.header}><Pressable style={styles.backButton} onPress={() => router.back()}><ArrowLeft color={colors.text} size={22} /></Pressable><Text style={styles.headerTitle}>Creator payouts</Text></View>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value.toLocaleString()}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function RequirementRow({ icon, title, detail, complete, first, last }: { icon: ReactNode; title: string; detail: string; complete: boolean; first?: boolean; last?: boolean }) {
  return (
    <View style={[styles.requirementRow, !last && styles.requirementBorder]}>
      <View style={[styles.requirementIcon, complete && styles.requirementIconComplete]}>{complete ? <CheckCircle2 color={colors.success} size={19} /> : icon}</View>
      <View style={styles.rowGrow}><Text style={styles.requirementTitle}>{title}</Text><Text style={styles.requirementDetail}>{detail}</Text></View>
      <View style={[styles.requirementState, complete && styles.requirementStateComplete]}><Text style={[styles.requirementStateText, complete && styles.requirementStateTextComplete]}>{complete ? "Done" : first ? "Active" : "Needed"}</Text></View>
    </View>
  );
}

function DetailChip({ label }: { label: string }) {
  return <View style={styles.detailChip}><CheckCircle2 color={colors.success} size={13} /><Text style={styles.detailChipText}>{label}</Text></View>;
}

function SettlementRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.settlementRow}><Text style={[styles.settlementLabel, strong && styles.settlementStrong]}>{label}</Text><Text style={[styles.settlementValue, strong && styles.settlementStrong]}>{value}</Text></View>;
}

function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <View style={styles.statusRow}>{good ? <CheckCircle2 color={colors.success} size={18} /> : <Clock3 color={colors.warning} size={18} />}<Text style={styles.statusLabel}>{label}</Text><Text style={[styles.statusValue, good && styles.good]}>{value}</Text></View>;
}

function MaskedRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.maskedRow}><Text style={styles.muted}>{label}</Text><Text style={styles.maskedValue}>{value}</Text></View>;
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string; hint?: string; error?: boolean }) {
  const { label, hint, error, ...inputProps } = props;
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...inputProps} placeholderTextColor={colors.muted} style={[styles.input, error && styles.inputError]} />{hint ? <Text style={[styles.fieldHint, error && styles.fieldHintError]}>{error ? `Check this value · ${hint}` : hint}</Text> : null}</View>;
}

function WithdrawalRow({ item }: { item: CreatorWithdrawal }) {
  const good = item.status === "PAID" || item.status === "APPROVED";
  const pending = item.status === "PENDING_REVIEW";
  return (
    <GlassCard style={styles.withdrawalRow}>
      <View style={styles.coinIcon}><Coins color={colors.gold} size={19} /></View>
      <View style={styles.withdrawalBody}>
        <Text style={styles.withdrawalTitle}>{item.amountCoins.toLocaleString()} coins · ₹{item.amountInr.toFixed(2)}</Text>
        <Text style={styles.muted}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recently"}</Text>
        {item.rejectionReason ? <Text style={styles.error}>{item.rejectionReason}</Text> : null}
      </View>
      <View style={[styles.withdrawalStatusPill, good && styles.withdrawalStatusGood, pending && styles.withdrawalStatusPending]}><Text style={[styles.withdrawalStatus, good && styles.good]}>{friendlyStatus(item.status)}</Text></View>
    </GlassCard>
  );
}

function friendlyStatus(value?: string) {
  if (!value) return "Not submitted";
  return value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
}

function isAdultDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  return date <= cutoff;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { height: 40, width: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyCard: { marginTop: 30, alignItems: "center", gap: 14, paddingVertical: 28 },
  hero: { gap: 12, borderRadius: 20, padding: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(246,180,75,0.22)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,180,75,0.14)", borderWidth: 1, borderColor: "rgba(246,180,75,0.28)" },
  heroEyebrow: { color: colors.gold, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  readinessPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(253,176,34,0.12)", borderWidth: 1, borderColor: "rgba(253,176,34,0.28)" },
  readinessPillReady: { backgroundColor: "rgba(50,213,131,0.12)", borderColor: "rgba(50,213,131,0.28)" },
  readinessPillText: { color: colors.warning, fontSize: 10, fontWeight: "900" },
  readinessPillTextReady: { color: colors.success },
  balanceLabel: { color: "rgba(255,255,255,0.66)", fontSize: 12, fontWeight: "800", marginTop: 4 },
  balanceLine: { flexDirection: "row", alignItems: "baseline" },
  balanceValue: { color: colors.text, fontSize: 38, lineHeight: 44, fontWeight: "900" },
  balanceUnit: { color: colors.gold, fontSize: 14, fontWeight: "900" },
  balanceEstimate: { color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: "700", marginTop: -8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 3 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  sectionCaption: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: -5, marginBottom: 10 },
  readinessCount: { color: colors.gold, fontSize: 22, fontWeight: "900" },
  requirementsCard: { paddingVertical: 4 },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  requirementBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  requirementIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  requirementIconComplete: { backgroundColor: "rgba(50,213,131,0.1)" },
  requirementTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  requirementDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: "700", marginTop: 2 },
  requirementState: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surface },
  requirementStateComplete: { backgroundColor: "rgba(50,213,131,0.1)" },
  requirementStateText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
  requirementStateTextComplete: { color: colors.success },
  activeRequest: { flexDirection: "row", alignItems: "center", gap: 12, borderColor: "rgba(253,176,34,0.28)", backgroundColor: "rgba(253,176,34,0.08)" },
  activeRequestIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(253,176,34,0.1)" },
  activeRequestTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginBottom: 3 },
  rowGrow: { flex: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  statusLabel: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "800" },
  statusValue: { color: colors.warning, fontSize: 12, fontWeight: "900" },
  good: { color: colors.success },
  maskedRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  maskedValue: { color: colors.text, fontSize: 13, fontWeight: "900" },
  infoText: { color: colors.cyan, fontSize: 12, lineHeight: 18, fontWeight: "800", marginTop: 10 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 8 },
  formCard: { gap: 12 },
  formHint: { color: colors.gold, fontSize: 12, fontWeight: "800" },
  documentChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(50,213,131,0.08)", borderWidth: 1, borderColor: "rgba(50,213,131,0.18)" },
  detailChipText: { color: colors.text, fontSize: 10, fontWeight: "800" },
  field: { gap: 6 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.surface, fontWeight: "700" },
  inputError: { borderColor: "rgba(255,91,110,0.7)" },
  fieldHint: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  fieldHintError: { color: colors.danger },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  consentText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  primaryButton: { minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  primaryText: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  secondaryButton: { minHeight: 44, borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong },
  secondaryText: { color: colors.text, fontWeight: "900" },
  privacyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  privacyText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  settlementBox: { gap: 8, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12 },
  settlementRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  settlementLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  settlementValue: { color: colors.text, fontSize: 12, fontWeight: "800" },
  settlementDivider: { height: 1, backgroundColor: colors.line },
  settlementStrong: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  withdrawalRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  coinIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,180,75,0.12)" },
  withdrawalBody: { flex: 1 },
  withdrawalTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginBottom: 3 },
  withdrawalStatusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(255,91,110,0.1)" },
  withdrawalStatusGood: { backgroundColor: "rgba(50,213,131,0.1)" },
  withdrawalStatusPending: { backgroundColor: "rgba(253,176,34,0.1)" },
  withdrawalStatus: { color: colors.warning, fontSize: 9, fontWeight: "900" }
});
