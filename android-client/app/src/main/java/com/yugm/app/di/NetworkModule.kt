package com.yugm.app.di

import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.YugmApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideYugmApi(): IYugmApi = YugmApi
}
