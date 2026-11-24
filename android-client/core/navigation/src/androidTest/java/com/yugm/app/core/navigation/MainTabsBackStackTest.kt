package com.yugm.app.core.navigation

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.SideEffect
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainTabsBackStackTest {
    @Test
    fun requestingChatFromSettingsReusesHomeAndDeliversTheRequestedTab() {
        ActivityScenario.launch(NavigationFixtureActivity::class.java).use { scenario ->
            scenario.awaitGraph()
            scenario.onActivity { activity ->
                val controller = activity.controller
                val home = controller.currentBackStackEntry!!
                home.savedStateHandle[MainTabsRoutes.SAVED_PAGE_KEY] = 4
                controller.navigate(Screen.Settings.route)
                assertEquals(Screen.Settings.route, controller.currentDestination?.route)

                controller.navigateTopLevel(Screen.ChatList.route)

                assertSame(home, controller.currentBackStackEntry)
                assertEquals(MainTabsRoutes.CHAT, home.savedStateHandle.get<String>(MainTabsRoutes.TAB_REQUEST_KEY))
                assertEquals(4, MainTabsRoutes.restoredPage(home.savedStateHandle))
                assertNull(controller.previousBackStackEntry)
            }
        }
    }

    @Test
    fun activityRecreationRestoresTheSecondaryScreenAndBackRevealsTheSavedTab() {
        ActivityScenario.launch(NavigationFixtureActivity::class.java).use { scenario ->
            scenario.awaitGraph()
            scenario.onActivity {
                val controller = it.controller
                controller.currentBackStackEntry!!.savedStateHandle[MainTabsRoutes.SAVED_PAGE_KEY] = 4
                controller.navigate(Screen.Settings.route)
            }
            scenario.recreate()
            scenario.awaitGraph()
            scenario.onActivity {
                val controller = it.controller
                assertEquals(Screen.Settings.route, controller.currentDestination?.route)
                assertFalse(MainTabsRoutes.isDockVisible(controller.currentDestination?.route, false, false))
                assertTrue(controller.popBackStack())
                assertEquals(Screen.MainTabs.route, controller.currentDestination?.route)
                assertEquals(4, MainTabsRoutes.restoredPage(controller.currentBackStackEntry!!.savedStateHandle))
                assertTrue(MainTabsRoutes.isDockVisible(controller.currentDestination?.route, false, false))
            }
        }
    }

    @Test
    fun pendingNotificationWaitsForStartupAndStaysConsumedAfterRecreation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val intent = Intent(context, NavigationFixtureActivity::class.java).putExtra("partnerId", "user-1")
        ActivityScenario.launch<NavigationFixtureActivity>(intent).use { scenario ->
            scenario.awaitGraph()
            scenario.onActivity {
                val controller = it.controller
                assertEquals(Screen.Chat.createRoute("user-1"), it.pendingPushRoute)
                assertFalse(PushNavigation.openWhenReady(controller, it.pendingPushRoute, false, true, true))
                assertFalse(PushNavigation.openWhenReady(controller, it.pendingPushRoute, true, false, true))
                assertFalse(PushNavigation.openWhenReady(controller, it.pendingPushRoute, true, true, false))
                controller.navigate(Screen.Splash.route)
                assertFalse(PushNavigation.openWhenReady(controller, it.pendingPushRoute, true, true, true))
                assertEquals(Screen.Splash.route, controller.currentDestination?.route)
                assertTrue(controller.popBackStack())
            }

            scenario.recreate()
            scenario.awaitGraph()
            scenario.onActivity {
                val controller = it.controller
                val pending = it.pendingPushRoute
                assertEquals(Screen.Chat.createRoute("user-1"), pending)
                assertTrue(PushNavigation.openWhenReady(controller, pending, true, true, true))
                assertTrue(PushNavigation.openWhenReady(controller, pending, true, true, true))
                assertEquals(Screen.Chat.route, controller.currentDestination?.route)
                assertEquals("user-1", controller.currentBackStackEntry?.arguments?.getString("partnerId"))
                assertFalse(MainTabsRoutes.isDockVisible(controller.currentDestination?.route, false, false))
                it.pendingPushRoute = null
                assertTrue(controller.popBackStack())
                assertEquals(Screen.MainTabs.route, controller.currentDestination?.route)
            }

            scenario.recreate()
            scenario.awaitGraph()
            scenario.onActivity {
                assertNull(it.pendingPushRoute)
                assertEquals(Screen.MainTabs.route, it.controller.currentDestination?.route)
            }
        }
    }

    @Test
    fun pushRoutingResolvesSupportedExtrasAndKeepsIdsInOnePathSegment() {
        assertEquals(Screen.Bonds.createRoute(center = true), PushNavigation.routeFromIntent(
            Intent().putExtra("type", "BONDS").putExtra("roomId", "room"),
        ))
        assertEquals(Screen.VideoRoom.createRoute("room"), PushNavigation.routeFromIntent(
            Intent().putExtra("roomId", "room").putExtra("callType", "video"),
        ))
        assertEquals(Screen.VoiceRoom.createRoute("room"), PushNavigation.routeFromIntent(
            Intent().putExtra("roomId", "room").putExtra("callType", "VOICE"),
        ))
        assertEquals(Screen.RoomLobby.createRoute("room"), PushNavigation.routeFromIntent(Intent().putExtra("roomId", "room")))
        assertEquals(Screen.ClanDetail.createRoute("clan"), PushNavigation.routeFromIntent(
            Intent().putExtra("clanId", "clan").putExtra("partnerId", "new"),
        ))
        assertEquals(Screen.Chat.createRoute("legacy"), PushNavigation.routeFromIntent(
            Intent().putExtra("chatPartnerId", "legacy").putExtra("partnerId", "new"),
        ))
        assertEquals("chat/user%2Fpart%3Fcall%3Dvoice", PushNavigation.routeFromIntent(
            Intent().putExtra("chatPartnerId", "").putExtra("partnerId", "user/part?call=voice"),
        ))
        assertNull(PushNavigation.routeFromIntent(Intent()))
    }

    private fun ActivityScenario<NavigationFixtureActivity>.awaitGraph() {
        lateinit var ready: CountDownLatch
        onActivity { ready = it.graphReady }
        assertTrue("The navigation fixture should reach its start destination", ready.await(5, TimeUnit.SECONDS))
    }
}

class NavigationFixtureActivity : ComponentActivity() {
    lateinit var controller: NavHostController
        private set
    val graphReady = CountDownLatch(1)
    var pendingPushRoute: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute = PushNavigation.restorePendingRoute(savedInstanceState, intent)
        setContent {
            val navController = rememberNavController()
            NavHost(navController, startDestination = Screen.MainTabs.route) {
                composable(Screen.MainTabs.route, listOf(navArgument("tab") {
                    type = NavType.StringType
                    defaultValue = MainTabsRoutes.DISCOVER
                })) {}
                composable(Screen.Settings.route) {}
                composable(Screen.Splash.route) {}
                composable(Screen.Chat.route, listOf(
                    navArgument("partnerId") { type = NavType.StringType },
                    navArgument("call") { type = NavType.StringType; defaultValue = "" },
                )) {}
            }
            SideEffect {
                controller = navController
                graphReady.countDown()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        PushNavigation.savePendingRoute(outState, pendingPushRoute)
    }
}
