package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.CreatorEarningBalance
import com.example.yugm.model.CreatorPayoutKycStatus
import com.example.yugm.model.TrustVerificationStatus
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.TextMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VerificationScaffold(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back", color = Gold) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
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
        Text("Show people you're real.", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
        Text("Verify your face and voice to show people you're real.", color = TextMuted)
        Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) { Text("Start") }
    }
}

@Composable
fun VerificationConsentScreen(onBack: () -> Unit, onAccept: () -> Unit) {
    VerificationScaffold("Consent", onBack) {
        Text("Yugm Trust Verification", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("We use your face, voice, and liveness submission only for platform trust and safety review.", color = TextMuted)
        Text("This is not payout KYC and does not collect PAN, UPI, or bank details.", color = TextMuted)
        Button(onClick = onAccept, modifier = Modifier.fillMaxWidth()) { Text("Accept and continue") }
    }
}

@Composable
fun FaceVerificationScreen(onBack: () -> Unit, onSubmit: (String) -> Unit) {
    var url by remember { mutableStateOf("") }
    VerificationScaffold("Face Verification", onBack) {
        Text("Add a selfie or liveness media URL.", color = TextMuted)
        OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("Selfie/liveness URL") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { onSubmit(url) }, modifier = Modifier.fillMaxWidth(), enabled = url.isNotBlank()) { Text("Submit face check") }
    }
}

@Composable
fun VoiceVerificationScreen(promptText: String, onBack: () -> Unit, onSubmit: (String) -> Unit) {
    var audioUrl by remember { mutableStateOf("") }
    VerificationScaffold("Voice Verification", onBack) {
        Text("Read this prompt aloud:", color = TextMuted)
        GlassCard(modifier = Modifier.fillMaxWidth()) { Text(promptText, color = Color.White, fontWeight = FontWeight.Bold) }
        OutlinedTextField(value = audioUrl, onValueChange = { audioUrl = it }, label = { Text("Audio URL") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { onSubmit(audioUrl) }, modifier = Modifier.fillMaxWidth(), enabled = audioUrl.isNotBlank()) { Text("Submit voice check") }
    }
}

@Composable
fun TrustVerificationStatusScreen(status: TrustVerificationStatus, onBack: () -> Unit, onSubmitReview: () -> Unit, onRetry: () -> Unit) {
    VerificationScaffold("Verification Status", onBack) {
        StatusRow("Status", status.status)
        StatusRow("Face", status.faceStatus)
        StatusRow("Voice", status.voiceStatus)
        StatusRow("Liveness", status.livenessStatus)
        if (!status.rejectionReason.isNullOrBlank()) Text(status.rejectionReason, color = TextMuted)
        Button(onClick = onSubmitReview, modifier = Modifier.fillMaxWidth()) { Text("Submit for review") }
        OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Retry") }
    }
}

@Composable
fun CreatorPayoutKycIntroScreen(onBack: () -> Unit, onStart: () -> Unit) {
    VerificationScaffold("Creator Payout Verification", onBack) {
        Text("Required only when you withdraw real money earned from gifts.", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("This is separate from Yugm Trust Verification and is shown only for creator payouts.", color = TextMuted)
        Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) { Text("Continue") }
    }
}

@Composable
fun CreatorPayoutKycFormScreen(onBack: () -> Unit, onSubmit: (String, String, String) -> Unit) {
    var legalName by remember { mutableStateOf("") }
    var pan by remember { mutableStateOf("") }
    var upi by remember { mutableStateOf("") }
    VerificationScaffold("Payout Details", onBack) {
        OutlinedTextField(value = legalName, onValueChange = { legalName = it }, label = { Text("Legal full name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = pan, onValueChange = { pan = it }, label = { Text("PAN") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = upi, onValueChange = { upi = it }, label = { Text("UPI ID") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { onSubmit(legalName, pan, upi) }, modifier = Modifier.fillMaxWidth(), enabled = legalName.isNotBlank() && pan.isNotBlank() && upi.isNotBlank()) {
            Text("Submit for finance review")
        }
    }
}

@Composable
fun CreatorPayoutKycStatusScreen(status: CreatorPayoutKycStatus, onBack: () -> Unit) {
    VerificationScaffold("Payout Verification", onBack) {
        StatusRow("KYC status", status.kycStatus)
        StatusRow("Payout status", status.payoutStatus)
        status.panLast4?.let { StatusRow("PAN", "****$it") }
        status.upiIdMasked?.let { StatusRow("UPI", it) }
        status.bankAccountLast4?.let { StatusRow("Bank", "****$it") }
        if (!status.rejectionReason.isNullOrBlank()) Text(status.rejectionReason, color = TextMuted)
    }
}

@Composable
fun WithdrawalEligibilityScreen(balance: CreatorEarningBalance, payoutKyc: CreatorPayoutKycStatus, onBack: () -> Unit, onWithdraw: (Int) -> Unit, onOpenKyc: () -> Unit) {
    var amount by remember { mutableStateOf("") }
    VerificationScaffold("Withdrawal", onBack) {
        StatusRow("Available", "${balance.availableCoins} coins")
        StatusRow("Locked", "${balance.lockedCoins} coins")
        StatusRow("Payout verification", payoutKyc.kycStatus)
        if (payoutKyc.kycStatus != "VERIFIED") {
            Button(onClick = onOpenKyc, modifier = Modifier.fillMaxWidth()) { Text("Complete Creator Payout Verification") }
        }
        OutlinedTextField(value = amount, onValueChange = { amount = it.filter(Char::isDigit) }, label = { Text("Coins to withdraw") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { onWithdraw(amount.toIntOrNull() ?: 0) }, modifier = Modifier.fillMaxWidth(), enabled = (amount.toIntOrNull() ?: 0) > 0) {
            Text("Request withdrawal")
        }
    }
}

@Composable
private fun StatusRow(label: String, value: String) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = TextMuted)
            Text(value, color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}
