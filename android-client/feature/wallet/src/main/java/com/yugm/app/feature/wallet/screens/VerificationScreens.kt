package com.yugm.app.feature.wallet.screens

import java.util.Locale
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.CreatorEarningBalance
import com.yugm.app.core.model.CreatorPayoutKycStatus
import com.yugm.app.core.model.PayoutRequirements
import com.yugm.app.core.model.TrustVerificationStatus
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.Success
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.yugm.app.core.ui.components.YugmLoadingSpinner

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VerificationScaffold(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Scaffold(
        topBar = {
            com.yugm.app.core.ui.components.YugmTopBar(
                title = title,
                onBack = onBack
            )
        },
        containerColor = LocalYugmColors.current.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
            }
        }
    }
}

@Composable
fun TrustVerificationIntroScreen(onBack: () -> Unit, onStart: () -> Unit) {
    VerificationScaffold("Yugm Trust Verification", onBack) {
        Text("Show people you're real.", color = LocalYugmColors.current.textPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
        Text("Verify your face and voice to show people you're real.", color = LocalYugmColors.current.textSecondary)
        Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) { Text("Start") }
    }
}

@Composable
fun VerificationConsentScreen(onBack: () -> Unit, onAccept: () -> Unit) {
    VerificationScaffold("Consent", onBack) {
        Text("Yugm Trust Verification", color = LocalYugmColors.current.textPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("We use your face, voice, and liveness submission only for platform trust and safety review.", color = LocalYugmColors.current.textSecondary)
        Text("This is not payout KYC and does not collect PAN, UPI, or bank details.", color = LocalYugmColors.current.textSecondary)
        Button(onClick = onAccept, modifier = Modifier.fillMaxWidth()) { Text("Accept and continue") }
    }
}

@Composable
fun FaceVerificationScreen(token: String, onBack: () -> Unit, onSubmit: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var uploadError by remember { mutableStateOf<String?>(null) }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        selectedUri = uri
        uploadError = null
    }

    VerificationScaffold("Face Verification", onBack) {
        Text("Take or pick a selfie for liveness verification.", color = LocalYugmColors.current.textSecondary)

        selectedUri?.let {
            Text("Selected: ${it.lastPathSegment ?: "image"}", color = LocalYugmColors.current.textPrimary)
        }

        uploadError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Button(
            onClick = { imagePicker.launch("image/*") },
            modifier = Modifier.fillMaxWidth(),
            enabled = !uploading
        ) {
            Text(if (selectedUri == null) "Choose selfie from gallery" else "Change photo")
        }

        Button(
            onClick = {
                val uri = selectedUri ?: return@Button
                uploading = true
                uploadError = null
                scope.launch {
                    runCatching {
                        val bytes = withContext(Dispatchers.IO) {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                ?: throw IllegalStateException("Could not read image")
                        }
                        val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                        val url = YugmApi.uploadTrustVerificationMedia(token, bytes, mimeType, "FACE")
                        onSubmit(url)
                    }.onFailure {
                        uploadError = it.message ?: "Upload failed"
                        uploading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = selectedUri != null && !uploading
        ) {
            if (uploading) {
                YugmLoadingSpinner(size = 20.dp)
                Spacer(Modifier.width(8.dp))
            }
            Text(if (uploading) "Uploading..." else "Submit face check")
        }
    }
}

@Composable
fun VoiceVerificationScreen(token: String, promptText: String, onBack: () -> Unit, onSubmit: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var uploadError by remember { mutableStateOf<String?>(null) }

    val audioPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        selectedUri = uri
        uploadError = null
    }

    VerificationScaffold("Voice Verification", onBack) {
        Text("Read this prompt aloud:", color = LocalYugmColors.current.textSecondary)
        GlassCard(modifier = Modifier.fillMaxWidth()) { Text(promptText, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) }

        selectedUri?.let {
            Text("Selected: ${it.lastPathSegment ?: "audio"}", color = LocalYugmColors.current.textPrimary)
        }

        uploadError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Button(
            onClick = { audioPicker.launch("audio/*") },
            modifier = Modifier.fillMaxWidth(),
            enabled = !uploading
        ) {
            Text(if (selectedUri == null) "Choose audio file" else "Change audio")
        }

        Button(
            onClick = {
                val uri = selectedUri ?: return@Button
                uploading = true
                uploadError = null
                scope.launch {
                    runCatching {
                        val bytes = withContext(Dispatchers.IO) {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                ?: throw IllegalStateException("Could not read audio")
                        }
                        val mimeType = context.contentResolver.getType(uri) ?: "audio/mpeg"
                        val url = YugmApi.uploadTrustVerificationMedia(token, bytes, mimeType, "VOICE")
                        onSubmit(url)
                    }.onFailure {
                        uploadError = it.message ?: "Upload failed"
                        uploading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = selectedUri != null && !uploading
        ) {
            if (uploading) {
                YugmLoadingSpinner(size = 20.dp)
                Spacer(Modifier.width(8.dp))
            }
            Text(if (uploading) "Uploading..." else "Submit voice check")
        }
    }
}

@Composable
fun TrustVerificationStatusScreen(status: TrustVerificationStatus, onBack: () -> Unit, onSubmitReview: () -> Unit, onRetry: () -> Unit) {
    VerificationScaffold("Verification Status", onBack) {
        Text("Current status: ${status.status.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }}", color = LocalYugmColors.current.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        StatusRow("Status", status.status)
        StatusRow("Face", status.faceStatus)
        StatusRow("Voice", status.voiceStatus)
        StatusRow("Liveness", status.livenessStatus)
        val rejectionReason = status.rejectionReason
        if (!rejectionReason.isNullOrBlank()) Text(rejectionReason, color = LocalYugmColors.current.textSecondary)
        val canSubmit = status.faceStatus != "NOT_SUBMITTED" && status.voiceStatus != "NOT_SUBMITTED" &&
            status.status !in setOf("PENDING_REVIEW", "VERIFIED", "SUSPENDED")
        if (canSubmit) Button(onClick = onSubmitReview, modifier = Modifier.fillMaxWidth()) { Text("Submit for review") }
        if (status.status in setOf("REJECTED", "NEEDS_RETRY", "EXPIRED")) {
            OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Try again") }
        }
    }
}

@Composable
fun CreatorPayoutKycIntroScreen(onBack: () -> Unit, onStart: () -> Unit) {
    VerificationScaffold("Creator Payout Verification", onBack) {
        Text("Turn gift earnings into payouts", color = LocalYugmColors.current.textPrimary, fontSize = 26.sp, fontWeight = FontWeight.Black)
        Text("Required only when you withdraw real money earned from gifts. This never affects normal Yugm access or your public verified badge.", color = LocalYugmColors.current.textSecondary, lineHeight = 21.sp)
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("What you'll need", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Black, fontSize = 13.sp)
            Spacer(Modifier.height(10.dp))
            DetailRow("1", "Legal identity", "Full name, date of birth, and PAN")
            DetailRow("2", "Settlement method", "UPI ID or bank account details")
            DetailRow("3", "Finance review", "Masked details are reviewed before payouts")
        }
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("Your sensitive identifiers are encrypted. Mobile and admin screens receive masked values only.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, lineHeight = 18.sp)
        }
        Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) { Text("Start payout verification") }
    }
}

@Composable
fun CreatorPayoutKycFormScreen(onBack: () -> Unit, onSubmit: (String, String, String) -> Unit) {
    var legalName by remember { mutableStateOf("") }
    var pan by remember { mutableStateOf("") }
    var upi by remember { mutableStateOf("") }
    var declarationsAccepted by remember { mutableStateOf(false) }
    val panValid = Regex("^[A-Z]{5}[0-9]{4}[A-Z]$").matches(pan)
    val upiValid = Regex("^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$").matches(upi)
    VerificationScaffold("Payout Details", onBack) {
        Text("Identity details", color = LocalYugmColors.current.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text("Enter the same legal details used by your payout account.", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
        OutlinedTextField(value = legalName, onValueChange = { legalName = it }, label = { Text("Legal full name") }, supportingText = { Text("Match the name printed on PAN") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(value = pan, onValueChange = { pan = it.uppercase().take(10) }, label = { Text("PAN") }, supportingText = { Text(if (pan.isNotBlank() && !panValid) "Enter a valid 10-character PAN" else "Example: ABCDE1234F") }, isError = pan.isNotBlank() && !panValid, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(value = upi, onValueChange = { upi = it.trim() }, label = { Text("UPI ID") }, supportingText = { Text(if (upi.isNotBlank() && !upiValid) "Enter a valid UPI ID" else "Example: creator@upi") }, isError = upi.isNotBlank() && !upiValid, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Switch(checked = declarationsAccepted, onCheckedChange = { declarationsAccepted = it })
            Text("I confirm these payout details belong to me and may be reviewed for creator settlement.", color = LocalYugmColors.current.textSecondary, modifier = Modifier.weight(1f))
        }
        Text("PAN and payout identifiers are encrypted. Yugm clients receive masked values only.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
        Button(onClick = { onSubmit(legalName, pan, upi) }, modifier = Modifier.fillMaxWidth(), enabled = legalName.trim().length >= 2 && panValid && upiValid && declarationsAccepted) {
            Text("Submit for finance review")
        }
    }
}

@Composable
fun CreatorPayoutKycStatusScreen(status: CreatorPayoutKycStatus, onBack: () -> Unit) {
    VerificationScaffold("Payout Verification", onBack) {
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text(if (status.kycStatus == "VERIFIED" && status.payoutStatus == "ENABLED") "Payout profile ready" else "Finance review status", color = if (status.kycStatus == "VERIFIED") Success else LocalYugmColors.current.secondary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(6.dp))
            Text(if (status.kycStatus == "VERIFIED") "Your masked payout profile is approved." else "Pull back into this screen later to see review updates.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
        }
        StatusRow("Verification status", status.kycStatus)
        StatusRow("Payout status", status.payoutStatus)
        status.panLast4?.let { StatusRow("PAN", "****$it") }
        status.upiIdMasked?.let { StatusRow("UPI", it) }
        status.bankAccountLast4?.let { StatusRow("Bank", "****$it") }
        val rejectionReason = status.rejectionReason
        if (!rejectionReason.isNullOrBlank()) Text(rejectionReason, color = LocalYugmColors.current.textSecondary)
    }
}

@Composable
fun WithdrawalEligibilityScreen(balance: CreatorEarningBalance, payoutKyc: CreatorPayoutKycStatus, requirements: PayoutRequirements, coinToInrRate: Double, onBack: () -> Unit, onWithdraw: (Int) -> Unit, onOpenKyc: () -> Unit) {
    var amount by remember { mutableStateOf("") }
    VerificationScaffold("Withdrawal", onBack) {
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("Available to withdraw", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text("${balance.availableCoins} gift coins", color = LocalYugmColors.current.textPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
            Text("Estimated ₹${"%.2f".format(Locale.US, balance.availableCoins * coinToInrRate)}", color = LocalYugmColors.current.secondary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(14.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                BalanceMini("Lifetime", balance.earnedCoins)
                BalanceMini("In review", balance.lockedCoins)
                BalanceMini("Paid", balance.withdrawnCoins)
            }
        }
        Text("Payout readiness", color = LocalYugmColors.current.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            ReadinessRow("Creator account", requirements.creatorAccount)
            ReadinessRow("Trust Verification", requirements.trustVerified && requirements.creatorTrustEnabled)
            ReadinessRow("Payout KYC", requirements.payoutKycVerified)
            ReadinessRow("Finance approval", requirements.payoutEnabled)
        }
        if (payoutKyc.kycStatus != "VERIFIED") {
            Button(onClick = onOpenKyc, modifier = Modifier.fillMaxWidth()) { Text("Complete Creator Payout Verification") }
        }
        OutlinedTextField(value = amount, onValueChange = { amount = it.filter(Char::isDigit) }, label = { Text("Coins to withdraw") }, modifier = Modifier.fillMaxWidth())
        val amountCoins = amount.toIntOrNull() ?: 0
        if (amountCoins > 0) {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                StatusLine("Requested", "$amountCoins coins")
                StatusLine("Settlement rate", "₹${"%.2f".format(Locale.US, coinToInrRate)} / coin")
                StatusLine("Estimated payout", "₹${"%.2f".format(Locale.US, amountCoins * coinToInrRate)}", highlight = true)
            }
        }
        if (amountCoins > balance.availableCoins) Text("Amount exceeds your available gift earnings.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        Button(
            onClick = { onWithdraw(amountCoins) },
            modifier = Modifier.fillMaxWidth(),
            enabled = payoutKyc.kycStatus == "VERIFIED" && payoutKyc.payoutStatus == "ENABLED" && amountCoins in 1..balance.availableCoins
        ) {
            Text("Request withdrawal")
        }
    }
}

@Composable
private fun DetailRow(number: String, title: String, detail: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(number, color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Black)
        Column { Text(title, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold); Text(detail, color = LocalYugmColors.current.textSecondary, fontSize = 12.sp) }
    }
}

@Composable
private fun BalanceMini(label: String, value: Int) {
    Column { Text(value.toString(), color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black); Text(label, color = LocalYugmColors.current.textSecondary, fontSize = 11.sp) }
}

@Composable
private fun ReadinessRow(label: String, complete: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
        Text(if (complete) "Done" else "Needed", color = if (complete) Success else LocalYugmColors.current.secondary, fontWeight = FontWeight.Black, fontSize = 12.sp)
    }
}

@Composable
private fun StatusLine(label: String, value: String, highlight: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
        Text(value, color = if (highlight) LocalYugmColors.current.secondary else LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StatusRow(label: String, value: String) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = LocalYugmColors.current.textSecondary)
            Text(value, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
        }
    }
}
